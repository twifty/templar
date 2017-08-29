/** @babel */
/** @jsx etch.dom */
/* global atom */

import etch from 'etch'
import foreach from 'lodash.foreach'
import {CompositeDisposable, Disposable} from 'atom'

export default class ListView {
  constructor({manager, onSelected}) {
    this.manager = manager
    this.items = null
    this.selected = null
    this.refMap = []
    this.callbacks = {
      onSelected: onSelected || (() => {})
    }

    etch.initialize(this);

    this.disposables = new CompositeDisposable()
    this.disposables.add(atom.commands.add(this.element, {
      'core:move-up': (e) => {
        this.selectPrev()
        e.stopPropagation()
      },
      'core:move-down': (e) => {
        this.selectNext()
        e.stopPropagation()
      },
      'core:move-to-top': (e) => {
        this.selectFirst()
        e.stopPropagation()
      },
      'core:move-to-bottom': (e) => {
        this.selectLast()
        e.stopPropagation()
      },
    }))

    let changeHandler = (items) => {
      this.update({
        items: items
      })
    }

    this.disposables.add(new Disposable(() => {
      this.manager.detach(changeHandler)
    }))

    this.manager.onChange(changeHandler)
    this.manager.list().then(changeHandler).catch(error => {
      atom.notifications.addError("Failed to populate template list", {
        dismissable: true,
        detail: error
      })
    })
  }

  destroy () {
    this.disposables.dispose()
  }

  setAttribute (key, value) {
    this.element.setAttribute(key, value)
  }

  addEventListener (name, cb) {
    this.element.addEventListener(name, cb)
  }

  focus () {
    if (this.refMap[this.selected]) {
      let selId = this.refMap[this.selected]
      this.refs[selId].focus()
    }
  }

  getSelected () {
    if (this.refMap[this.selected]) {
      let id = this.refMap[this.selected]
      return this.items[id]
    }

    return null
  }

  selectFirst () {
    this.select(0)
  }

  selectLast () {
    if (this.refMap.length)
      this.select(this.refMap.length - 1)
  }

  selectPrev () {
    if (this.selected != null)
      this.select(this.selected - 1)
  }

  selectNext () {
    if (this.selected != null)
      this.select(this.selected + 1)
  }

  select(index) {
    if (this.refMap.length) {
      if (index < 0)
        index = this.refMap.length - 1
      else if (index >= this.refMap.length)
        index = 0

      let id = this.refMap[index]

      if (this.selected != index) {
        if (this.selected != null) {
          let selId = this.refMap[this.selected]
          this.refs[selId].classList.remove('selected')
        }

        this.refs[id].classList.add('selected')
        this.refs[id].scrollIntoView()
        this.selected = index

        this.callbacks.onSelected()
      }
    }
  }

  update ({items} = {}) {
    if (items)
      this.items = items;

    let prevSelection = this.selected
    return etch.update(this).then(() => {
      if (prevSelection !== this.selected) {
        this.callbacks.onSelected()
      }
    }).catch(error => {
      atom.notifications.addError("Failed to update template list", {
        dismissable: true,
        detail: error
      })
    })
  }

  render () {
    const children = [];
    this.refMap = [];

    let index = 0;
    if (this.items) {
      foreach(this.items, (meta, id) => {
        let clickHandler = which => {
          return () => this.select(which)
        }

        let classes = 'template-list-item'
        let tabIndex = -1

        if ((0 === index && !this.selected) || index === this.selected) {
          classes += ' selected'
          tabIndex = 0
          this.selected = index
        }

        this.refMap[index] = id

        children.push((
          <li ref={id} className={classes} tabIndex={tabIndex} onClick={clickHandler(index)}>
            <span>{meta.name}</span>
          </li>
        ))

        index++
      })

      if (0 === children.length) {
        children.push((
          <li><span>Click &#39;Create&#39; to build your first template...</span></li>
        ))
      } else if (this.selected >= children.length) {
        this.selected = 0
        children[0].props.className += ' selected'
        children[0].props.tabIndex = 0
      }
    } else {
      children.push((
        <li><span>Loading Template metadata...</span></li>
      ))
    }

    return (
      <div className='template-list select-list'>
        {etch.dom('ol', {
          className: 'list-group',
          tabIndex: '-1'
        }, ...children)}
      </div>
    )
  }
}
