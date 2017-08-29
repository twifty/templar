/** @babel */
/** @jsx etch.dom */
/* global atom Promise RegExp require */

import path from 'path'
import fs from 'fs-plus'
import etch from 'etch'
import {CompositeDisposable, TextEditor} from 'atom'

export default class TemplateFactory {
  constructor (config) {
    this.disposables = new CompositeDisposable()
    this.destroyed = false

    this.placeHolderExpression = new RegExp(config.expr, 'ig')
    this.placeHoldersGlobal = {}
    this.placeHoldersProject = {}

    if (config.macro)
      this.placeHoldersGlobal = require(config.macro)
  }

  destroy () {
    this.destroyed = true
    this.disposables.dispose()
    this.modal.destroy()
    this.modal = null

    return etch.destroy(this)
  }

  createFile (dir, meta) {
    if (this.destroyed)
      return atom.notifications.addError('The modal window has been destroyed')

    this.create({
      dir,
      meta,
      prefix: dir + '/' + (meta.prefix || ''),
      postfix: (meta.postfix || '') + meta.ext ? ('.' + meta.ext) : ''
    }).then(() => {
      this.modal.show()
      this.refs.fileName.element.focus()
    })
  }

  hide () {
    if (this.modal)
      this.modal.hide()
  }

  onConfirm () {
    let name = this.refs.fileName.getText().trim()

    if (!name) {
      return this.refs.fileName.element.classList.add('required-field')
    }

    this.props.fileName = name + this.props.meta.postfix
    this.props.fileTarget = this.props.prefix + name + this.props.postfix

    this.readTemplate(this.props)
      .then(this.writeTemplateTarget)
      .then(meta => {
        atom.workspace.open(meta.fileTarget)
      })
      .catch(error => {
        atom.notifications.addError('Failed to create file', {
          dismissable: true,
          detail: error
        })
      })

    this.hide()
  }

  writeTemplateTarget (meta) {
    return new Promise((resolve, reject) => {
      fs.writeFile(meta.fileTarget, meta.content, (error) => {
        if (error)
          return reject(error)

        resolve(meta)
      })
    })
  }

  readTemplate (meta) {
    return new Promise((resolve, reject) => {
      fs.stat(meta.fileTarget, (error) => {
        if (!error)
          return reject(`file ${meta.fileTarget} already exists`)

        if (error.code !== 'ENOENT')
          return reject(`stat call for ${meta.fileTarget} failed with code ${error.code}`)

        fs.readFile(meta.meta.url, 'utf8', (error, content) => {
          if (error)
            return reject(error)

          try {
            let placeHolders = this.loadProjectPlaceHolders(meta)

            resolve(this.resolvePlaceHolders(meta, content, placeHolders))
          } catch (error) {
            return reject(error)
          }
        })
      });
    })
  }

  loadProjectPlaceHolders (meta) {
    let [projectPath, relativePath] = atom.project.relativizePath(meta.fileTarget)

    if (!projectPath)
      throw new Error("A project doesn't exist for the target file")

    if (!this.placeHoldersProject[projectPath]) {
      try {
        let templarPath = path.join(projectPath, 'templar')
        this.placeHoldersProject[projectPath] = require(templarPath)
      } catch (e) {
        this.placeHoldersProject[projectPath] = {}
      }
    }

    let placeHolders = this.placeHoldersProject[projectPath]

    if (typeof placeHolders.meta === 'undefined')
      placeHolders.meta = meta;

    if (typeof placeHolders.name === 'undefined')
      placeHolders.name = meta.fileName;

    if (typeof placeHolders.path === 'undefined')
      placeHolders.path = relativePath;

    return placeHolders
  }

  resolvePlaceHolders (meta, content, placeHolders) {
    meta.content = content.replace(this.placeHolderExpression, (_, match) => {
      let action = placeHolders[match]

      if (typeof action === 'undefined')
        action = this.placeHoldersGlobal[match]

      if (typeof action === 'function')
        action = action(placeHolders)

      if (action != null)
        return String(action)

      return ''
    })

    return meta
  }

  create (props) {
    this.props = props

    if (!this.modal) {
      etch.initialize(this)
      this.modal = atom.workspace.addModalPanel({item: this.element, visible: false})

      this.disposables.add(atom.commands.add(this.element, {
        'core:confirm': (e) => {
          this.onConfirm()
          e.stopPropagation()
        },
        'core:cancel': (e) => {
          this.hide()
          e.stopPropagation()
        }
      }))

      return Promise.resolve()
    } else {
      return etch.update(this)
    }
  }

  update () {
    return etch.update(this)
  }

  render () {
    return (
      <div className='template-create'>
        <span>{this.props.prefix}</span>
        <TextEditor ref='fileName' mini={true} placeholderText='File Name' />
        <span>{this.props.postfix}</span>
      </div>
    )
  }
}
