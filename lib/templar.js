/** @babel */
/* global atom */

import path from 'path'
import foreach from 'lodash.foreach'
import {CompositeDisposable} from 'atom'
import TemplateManager from './template-manager.js'
import TemplateManagerView from './template-manager-view.js'
import TemplateFactoryView from './template-factory-view.js'

class Templar {
  packageName = 'templar'
  config = {
    templateStore: {
      type: 'string',
      default: path.join(atom.getUserInitScriptPath(), '../', 'template-store')
    },
    placeHolderExpression: {
      type: 'string',
      default: '{{\\s*(\\w+)\\s*}}'
    },
    placeHolderMacros: {
      type: 'string',
      default: ''
    }
  }

  constructor () {
    this.subscriptions = new CompositeDisposable
    this.menuCommands = new CompositeDisposable
  }

  activate () {
    this.templateStore = atom.config.get(this.packageName + '.templateStore')
    this.templateManager = new TemplateManager(this.templateStore)
    this.templateEditor = new TemplateManagerView(this.templateManager)
    this.templateFactory = new TemplateFactoryView({
      expr: atom.config.get(this.packageName + '.placeHolderExpression'),
      macro: atom.config.get(this.packageName + '.placeHolderMacros')
    })

    this.subscriptions.add(atom.commands.add('atom-workspace', this.packageName + ':manage-templates', () => {
      this.templateEditor.show()
    }))

    this.subscriptions.add(atom.commands.add('.tree-view .selected', this.packageName + ':new-template', () => {
      this.createTemplate()
    }))

    this.subscriptions.add(this.templateManager.onChange(items => this.createContextMenu(items)))
    this.templateManager.list().then(items => this.createContextMenu(items))

    atom.contextMenu.add({
      '.tree-view .directory .header': [{
        label: 'New Template',
        command: this.packageName + ':new-template'
      }]
    })
  }

  deactivate () {
    this.destroyContextMenu()
    this.subscriptions.dispose()
    this.templateEditor.destroy()
  }

  createTemplate (dir, meta) {
    if (!(dir && meta))
      return this.templateEditor.show()

    this.templateFactory.createFile(dir, meta)
  }

  createContextMenu (items) {
    let menuGroups = {}
    let subMenus = []
    let groupCount = 0

    foreach(items, (meta) => {
      let type = meta.type || 'Mixed'

      if (!menuGroups[type]) {
        menuGroups[type] = {label: type, submenu: []}
        subMenus.push(menuGroups[type])
        groupCount++
      }

      menuGroups[type].submenu.push({
        label: meta.name,
        command: this.createCommand(meta)
      })
    })

    let mainMenu = this.getContextMenuEntry()

    if (0 === groupCount) {
      this.destroyContextMenu(mainMenu)
    } else {
      mainMenu.oldCommand = mainMenu.command
      delete mainMenu.command

      mainMenu.submenu = (1 === groupCount) ? subMenus[0].submenu : subMenus
    }
  }

  destroyContextMenu (menu) {
    if (!menu)
      menu = this.getContextMenuEntry()

    if (menu.oldCommand) {
      menu.command = menu.oldCommand
      delete menu.oldCommand
      delete menu.submenu
    }

    this.menuCommands.dispose()
  }

  getContextMenuEntry () {
    if (this.contextMenuEntry)
      return this.contextMenuEntry

    let menuItems = atom.contextMenu.itemSets
    let mainCommand = this.packageName + ':new-template'

    for (let menu in menuItems) {
      let items = menuItems[menu].items;
      for (let i = items.length; i--;) {
        let item = items[i];
        if (item && mainCommand === item.command) {
          return this.contextMenuEntry = item
        }
      }
    }
  }

  createCommand (meta) {
    let command = this.packageName + ':create-' + meta.name.toLowerCase().split(' ').join('-')

    this.menuCommands.add(atom.commands.add('.tree-view .directory .name', command, (event) => {
      this.createTemplate(event.target.dataset.path, meta)
    }))

    return command
  }
}

export default new Templar()
