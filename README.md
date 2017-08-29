# Templar

Adds the ability to use templates within the editor.

Template files can be written for any language with the ability to replace placeholder names with real values. Templates can also be grouped by project type or language, making them easier to find.

### Usage

Run the command `templar:manage-templates` or navigate to `Packages -> Templar -> Manage Templates` to create your templates.

The fields include:
* **Template Name**: The name which appears in the menus.
* **Name Prefix**: (optional) A file name prefix, which all new files using this template MUST use.
* **Name Postfix**: (optional) A file name postfix, which all new files using this template MUST use.
* **Project Type**: (optional) A simple group name. Using more than one group name will add the group as a submenu to the context menu.
* **File Extension**: (optional) The extension to give all new files.

Once a template has been created, it will be available from the context menu on the projects file tree.

### Advanced
A `templar` file can be configured from both the package settings and the root directory of a project. Both files will be loaded, but the projects file will take precedence over global. The file must be loadable by a `require` call and export a simple object. The keys of this object map to placeholders within the template. The values will be converted to strings and injected into the template. If a value is a javascript `function`, it will be called with an object containing all known placeholder values. This gives you full control over how the template is written.

A simple `templar.js` example:

```js
module.exports = {
  author: 'Me',
  namespace: function(props) {
    return props.path.split('/').slice(1, -1).join('\\')
  }
}
```

with a template:

```php
namespace {{ namespace }};

/**
 * @author {{author}}
 */
abstract class Abstract{{ name }} {
  //...
}
```
