/** @babel */
/** @jsx etch.dom */
/* global atom window */

import etch from 'etch'
import foreach from 'lodash.foreach'
import {CompositeDisposable, TextEditor} from 'atom'
import ListView from './template-list-view'

export default class TemplateManagerView {
  constructor (templates) {
    this.state = null
    this.empty = true;
    this.templates = templates
    this.disposables = new CompositeDisposable()
  }

  destroy () {
    this.disposables.dispose()
    this.modal.destroy();
    this.modal = null;
    this.state = null;

    return etch.destroy(this)
  }

  toggle () {
    if (this.modal && this.modal.isVisible())
      this.hide()
    else
      this.show()
  }

  show () {
    if (!this.modal)
      this.createModal()

    this.modal.show()
    this.refs.displayName.element.focus()
  }

  hide () {
    if (this.modal)
      this.modal.hide()
  }

  onCreate () {
    this.switchState('create')
  }

  onEdit () {
    this.switchState('edit')
  }

  onDelete() {
    this.switchState('delete')
  }

  onSelection() {
    this.switchState('browse')
  }

  onConfirm () {
    const name = this.refs.displayName.getText().trim()
    let meta = this.refs.listView.getSelected()

    if ('delete' === this.state) {
      this.templates.list().then(items => {
        delete items[meta.id]

        atom.workspace.getTextEditors().forEach((editor) => {
          if (editor.getPath() === meta.url) {
            atom.workspace.getPanes().forEach(pane => {
              pane.destroyItem(editor, true)
            })
          }
        })

        // The listview needs updating first because the promise will resolve later
        return this.refs.listView.update({items}).then(() => {
          this.switchState('browse')
          this.templates.remove(meta)
        })
      }).catch(error => {
        atom.notifications.addError("Failed to delete template", {
          dismissable: true,
          detail: error
        })
      })
    } else if (name) {
      switch (this.state) {
        case 'create':
          this.templates.create({
            name: name,
            prefix: this.refs.namePrefix.getText(),
            postfix: this.refs.namePostfix.getText(),
            type: this.refs.projectType.getText(),
            ext: this.refs.fileExtension.getText(),
          }).then(meta => {
            return this.openEditor(meta).then(editor => {
              editor.onDidSave(() => {
                this.templates.update(meta)
              })
            })
          }).catch(error => {
            atom.notifications.addError("Failed to create template", {
              dismissable: true,
              detail: error
            })
          })
          break

        case 'edit':
          meta.name = name
          meta.prefix = this.refs.namePrefix.getText()
          meta.postfix = this.refs.namePostfix.getText()
          meta.type = this.refs.projectType.getText()
          meta.ext = this.refs.fileExtension.getText()

          this.openEditor(meta).then(() => {
            this.templates.update(meta)
          }).catch(error => {
            atom.notifications.addError("Failed to edit template", {
              dismissable: true,
              detail: error
            })
          })
          break;
      }

      this.destroy()
    } else {
      this.refs.displayName.element.classList.add('required-field')
    }
  }

  onCancel () {
    switch (this.state) {
      case 'create':
      case 'delete':
      case 'edit':
        this.switchState('browse');
      break;

      default:
        this.hide()
    }
  }

  createModal () {
    etch.initialize(this)

    this.disposables.add(atom.commands.add(this.element, {
      'core:confirm': (e) => {
        this.onConfirm()
        e.stopPropagation()
      },
      'core:cancel': (e) => {
        this.destroy()
        e.stopPropagation()
      }
    }))

    this.modal = atom.workspace.addModalPanel({item: this.element, visible: false})
    this.switchState('browse')
  }

  openEditor (meta) {
    return atom.workspace.open(meta.url).then(editor => {
      editor.getTitle = () => meta.name + " Template"
      editor.getLongTitle = () => meta.name + " Template"
      editor.emitter.emit("did-change-title", editor.getTitle())

      return editor
    }).catch(error => {
      atom.notifications.addError("Failed to open editor for template", {
        dismissable: true,
        detail: error
      })
    })
  }

  updateFields (meta = {}) {
    this.refs.confirmName.innerHTML = meta.name || ''
    this.refs.displayName.setText(meta.name || '')
    this.refs.namePrefix.setText(meta.prefix || '')
    this.refs.namePostfix.setText(meta.postfix || '')
    this.refs.projectType.setText(meta.type || '')
    this.refs.fileExtension.setText(meta.ext || '')
  }

  hideFields () {
    const args = Array.prototype.slice.call(arguments)
    foreach(this.refs, (element, key) => {
      if (element.element)
        element = element.element
      element.style.display = args.indexOf(key) >= 0 ? 'none' : ''
    })
  }

  switchState (state) {
    let meta = this.refs.listView.getSelected()
    let inputEnabled = true
    let tabOrder = null

    switch (state) {
      case 'browse':
        this.refs.displayName.element.classList.remove('required-field')
        if (meta) {
          this.updateFields(meta)
          this.hideFields('confirmButton', 'confirmDelete')
          this.refs.inputFields.setAttribute('disabled', true)
          tabOrder = ['listView', 'createButton', 'editButton', 'deleteButton', 'cancelButton']
          inputEnabled = false
        } else {
          this.updateFields()
          tabOrder = ['createButton', 'cancelButton']
          this.hideFields('inputFields', 'confirmDelete', 'confirmButton', 'editButton', 'deleteButton')
        }
        break;

      case 'delete':
        this.hideFields('inputFields', 'listView', 'editButton', 'createButton', 'deleteButton')
        tabOrder = ['confirmButton', 'cancelButton']
        this.refs.inputFields.setAttribute('disabled', true)
        inputEnabled = false
        break

      case 'create':
        this.updateFields()
        this.hideFields('confirmDelete', 'listView', 'editButton', 'createButton', 'deleteButton')
        tabOrder = ['displayName', 'namePrefix', 'namePostfix', 'projectType', 'fileExtension', 'confirmButton', 'cancelButton']
        this.refs.inputFields.removeAttribute('disabled')
        break

      case 'edit':
        this.hideFields('confirmDelete', 'listView', 'editButton', 'createButton', 'deleteButton')
        tabOrder = ['displayName', 'namePrefix', 'namePostfix', 'projectType', 'fileExtension', 'confirmButton', 'cancelButton']
        this.refs.inputFields.removeAttribute('disabled')
        break
    }

    this.state = state

    let index = inputEnabled ? 0 : -1

    this.refs.displayName.element.tabIndex = index
    this.refs.namePrefix.element.tabIndex = index
    this.refs.namePostfix.element.tabIndex = index
    this.refs.projectType.element.tabIndex = index
    this.refs.fileExtension.element.tabIndex = index

    let focusElement = (index = 0) => {
      let element = this.refs[tabOrder[index]]
      if (typeof element.focus !== 'function')
        element = element.element
      element.focus()
    }

    let tabber = () => {
      let tabIndex = 0;
      return event => {
        if ('Tab' === event.key) {
          event.preventDefault()
          if (event.shiftKey) {
            if (--tabIndex < 0)
              tabIndex = tabOrder.length - 1
          } else if (++tabIndex >= tabOrder.length) {
            tabIndex = 0;
          }
          focusElement(tabIndex)
        }
      }
    }

    this.element.addEventListener('keydown', tabber())

    // Fix focus problems on first load
    window.setTimeout(focusElement, 0)
  }

  update () {
    return etch.update(this).then(() => {
      this.switchState(this.state)
    }).catch(error => {
      atom.notifications.addError("Failed to update modal window", {
        dismissable: true,
        detail: error
      })
    })
  }

  render () {
    let handleEnter = (event) => {
      if (13 === event.keyCode) {
        event.stopPropagation()
      }
    }

    return (
      <div className='overlay from-top template-panel'>
        <div ref='confirmDelete' className='template-confirm-delete'>
          <h1>Are you sure you want to delete?</h1>
          <h3><span ref='confirmName'></span></h3>
        </div>

        <fieldset ref='inputFields'>
          <div className='template-input-group'>
            <div className='template-input-item'>
              <TextEditor ref='displayName' mini={true} placeholderText='Display Name' />
            </div>
          </div>
          <div className='template-input-group'>
            <div className='template-input-item'>
              <TextEditor ref='namePrefix' mini={true} placeholderText='Name Prefix' />
            </div>
            <div className='template-input-item'>
              <TextEditor ref='namePostfix' mini={true} placeholderText='Name Postfix' />
            </div>
          </div>
          <div className='template-input-group'>
            <div className='template-input-item'>
              <TextEditor ref='projectType' mini={true} placeholderText='Project Type' />
            </div>
            <div className='template-input-item'>
              <TextEditor ref='fileExtension' mini={true} placeholderText='File Extension' />
            </div>
          </div>
        </fieldset>

        <ListView ref='listView' manager={this.templates} onSelected={() => this.onSelection()} />

        <div className='template-input-group'>
          <button ref='createButton' className='btn template-input-button' onClick={() => this.onCreate()} onKeyDown={handleEnter} >
            Create
          </button>
          <button ref='confirmButton' className='btn template-input-button' onClick={() => this.onConfirm()} onKeyDown={handleEnter} >
            Confirm
          </button>
          <button ref='editButton' className='btn template-input-button' onClick={() => this.onEdit()} onKeyDown={handleEnter} >
            Edit
          </button>
          <button ref='deleteButton' className='btn template-input-button' onClick={() => this.onDelete()} onKeyDown={handleEnter} >
            Delete
          </button>
          <button ref='cancelButton' className='btn template-input-button' onClick={() => this.onCancel()} onKeyDown={handleEnter} >
            Cancel
          </button>
        </div>
      </div>
    )
  }
}
