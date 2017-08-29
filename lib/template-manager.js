/** @babel */
/* global Promise */

import fs from 'fs-plus'
import path from 'path'
import {Disposable} from 'atom'

export default class TemplateManager {
  constructor (store) {
    this.store = store
    this.cache = null
    this.changeHandlers = []
  }

  initialize () {
    return new Promise((resolve, reject) => {
      fs.makeTree(this.store, error => {
        if (error)
          return reject(error)

        fs.readFile(path.join(this.store, 'index.json'), (error, data) => {
          if (error) {
            if (error.code == "ENOENT")
              resolve({})
            else
              reject(error)
          }
          else {
            resolve(JSON.parse(data))
          }
        })
      })
    })
  }

  onChange (cb) {
    if (this.changeHandlers.indexOf(cb) < 0)
      this.changeHandlers.push(cb)

    return new Disposable(() => {
      this.detach(cb)
    })
  }

  detach (cb) {
    let index = this.changeHandlers.indexOf(cb)
    this.changeHandlers.splice(index, 1)
  }

  list () {
    return this.initialize()
  }

  meta (id) {
    return this.initialize().then(files => {
      if (!files[id])
        throw new Error(`Template ${id} not found`)

      return files[id]
    })
  }

  create (meta) {
    if (!(meta && meta.name))
      return Promise.reject("The 'name' field is required")

    meta.id = new Date().getTime().toString()
    meta.url = path.join(this.store, meta.id + '.template')

    return Promise.resolve(meta)
  }

  update (meta) {
    if (!(meta && meta.id)) {
      return Promise.reject("The 'id' field is required")
    }

    meta.url = path.join(this.store, meta.id + '.template')

    return this.initialize().then(files => {
      let promise

      fs.stat(meta.url, error => {
        if (error) { // template doesn't exist
          if (meta.content) {
            promise = new Promise((resolve, reject) => {
              fs.writeFile(meta.url, meta.content, error => {
                if (error)
                  return reject(error)
                resolve()
              })
            })
          } else {
            promise = Promise.reject(`Template ${meta.url} not found`)

            if (files[meta.id]) {
              delete files[meta.id]
              return this.flush(files).then(() => {
                return promise
              })
            }

            return promise
          }
        } else {
          delete meta['content']
          promise = Promise.resolve()
        }

        return promise.then(() => {
          files[meta.id] = meta;
          return this.flush(files)
        })
      })
    })
  }

  remove (meta) {
    return this.initialize().then(files => {
      if (meta && files[meta.id]) {
        delete files[meta.id]
        return new Promise(resolve => {
          fs.unlink(meta.url, () => {
            this.flush(files).then(files => {
              resolve(files)
            })
          })
        })
      }
    })
  }

  flush (files) {
    return new Promise((resolve, reject) => {
      let raw = JSON.stringify(files)
      fs.writeFile(path.join(this.store, 'index.json'), raw, (err) => {
        if (err)
          return reject(err)

        try {
          this.changeHandlers.forEach(handle => {
            handle(files)
          })
        } catch (error) {
          return reject(error)
        }

        resolve(files)
      })
    })
  }
}
