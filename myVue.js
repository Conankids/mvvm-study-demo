// 编译器工具函数
const compileUtils = {
  // 获取data中exp表达式的内容，例：exp: 'person.msg'
  getVal(exp, data) {
    // person.name->[person,name]->data[person][name]
    // 使用.分割表达式，使用reduce函数的累加功能获取表达式的值
    return exp.split('.').reduce((prevData, curValue) => {
      return prevData[curValue]
    }, data)
  },
  // 设置data中exp表达式的内容，例：exp: 'person.msg'
  setVal(exp, value, data) {
    // 使用.分割表达式，使用reduce函数的累加功能设置表达式的值
    exp.split('.').reduce((prevData, curValue, curIndex, arr) => {
      // 当curIndex是最后一位时设置value
      if (curIndex == arr.length - 1) {
        prevData[curValue] = value
      }
      return prevData[curValue]
    }, data)
  },
  // 判断是否是以v-开头的属性
  isDirective(attrName) {
    return ~attrName.indexOf('v-')
  },
  // 解析文本
  text(el, exp, vm) {
    let value
    // 判断是属性还是{{}}包裹的文本节点
    if (~exp.indexOf('{{')) {
      value = exp.replace(/\{\{(.+?)\}\}/g, (...args) => {
        return this.getVal(args[1], vm.$data)
      })
    } else {
      value = this.getVal(exp, vm.$data)
      // 创建观察者并设置更新回调
      new Watcher(vm, exp, () => {
        this.updater.updateText(el, value)
      })
    }
    this.updater.updateText(el, value)
  },
  // 解析html属性
  html(el, exp, vm) {
    // 创建观察者并设置更新回调
    new Watcher(vm, exp, () => {
      this.updater.updateHtml(el, this.getVal(exp, vm.$data))
    }).update()
  },
  // 解析model属性
  model(el, exp, vm) {
    // 创建观察者并设置更新回调
    new Watcher(vm, exp, () => {
      this.updater.updateModel(el, this.getVal(exp, vm.$data))
    }).update()

    // 给绑定model的form元素添加input事件，用来更改绑定的值
    el.addEventListener(
      'input',
      () => {
        // 设置绑定值
        this.setVal(exp, el.value, vm.$data)
      },
      false
    )
  },
  // 解析on事件
  on(el, event, exp, vm) {
    let fn = vm.$methods[exp].bind(vm)
    // 给el绑定event事件
    el.addEventListener(event, fn)
  },
  // 解析bind属性
  bind(el, attr, exp, vm) {
    // 创建观察者并设置更新回调
    new Watcher(vm, exp, () => {
      // 更新bind绑定的属性
      el.setAttribute(attr, this.getVal(exp, vm.$data))
    }).update()
  },
  updater: {
    // 更新文本
    updateText(node, value) {
      node.textContent = value
    },
    // 更新html
    updateHtml(node, value) {
      node.innerHTML = value
    },
    // 更新表单控件
    updateModel(node, value) {
      node.value = value
    }
  }
}

// 编译器
class Compiler {
  constructor(el, vm) {
    // 获取当前元素节点
    this.$el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    // 把节点转换成代码片段
    this.fragment = this.node2Fragment(this.$el)
    // 解析代码片段
    this.parseElement(this.fragment)
  }
  // 判断是否是元素节点
  isElementNode(node) {
    return node.nodeType == 1
  }
  node2Fragment(el) {
    // 创建空的代码片段
    let fragment = document.createDocumentFragment()
    // 循环元素节点并将其添加到代码片段中
    while (el.firstChild) {
      fragment.appendChild(el.firstChild)
    }
    return fragment
  }
  parseElement(el) {
    // 循环解析元素节点
    for (let child of el.childNodes) {
      this.parseNode(child)
    }
  }
  parseNode(child) {
    // 循环遍历解析孩子节点
    if (child.childNodes && child.childNodes.length) {
      this.parseElement(child)
    }

    // 判断节点类型，并解析
    if (this.isElementNode(child)) {
      // 获取元素节点的所有属性
      let attrs = child.attributes

      // 遍历属性并解析
      ;[...attrs].forEach(attr => {
        this.parseAttr(attr, child)
      })
    } else {
      // 解析文本节点
      let exp = child.nodeValue
      this.parseText(child, exp)
    }
  }
  parseAttr(attr, child) {
    // 获取属性名、属性值
    let { nodeName, nodeValue } = attr
    // 判断是否是v-开头的属性
    if (compileUtils.isDirective(nodeName)) {
      // 获取属性名
      let [, dir] = nodeName.split('-')
      // 解析属性值
      compileUtils[dir] && compileUtils[dir](child, nodeValue, this.vm)

      // 判断是否是事件属性
      if (~nodeName.indexOf('on')) {
        let [, event] = nodeName.split(':')
        compileUtils['on'](child, event, nodeValue, this.vm)
      }
      // 判断是否是bind属性
      if (~nodeName.indexOf('bind')) {
        let [, attr] = nodeName.split(':')
        compileUtils['bind'](child, attr, nodeValue, this.vm)
      }
      // 删除自定义的v-属性
      child.removeAttribute(nodeName)
    }
    // 判断是否是@开头的简写事件
    if (~nodeName.indexOf('@')) {
      let [, event] = nodeName.split('@')
      compileUtils['on'](child, event, nodeValue, this.vm)
      child.removeAttribute(nodeName)
    }
  }
  parseText(node, exp) {
    // 替换文本中{{}}包裹的值
    let value = exp.replace(/\{\{(.+?)\}\}/g, (...args) => {
      // 创建watcher观察者，并设置更新回调函数
      new Watcher(this.vm, args[1], () => {
        compileUtils['text'](node, exp, this.vm)
      })
      return compileUtils.getVal(args[1], this.vm.$data)
    })
    // 更新文本节点内容
    compileUtils['updater']['updateText'](node, value)
  }
}

class MVue {
  constructor(options) {
    this.$options = options
    this.$el = options.el
    this.$data = options.data
    this.$methods = options.methods
    // 1、劫持数据
    new Observer(this)

    // 2、编译模板
    let compiler = new Compiler(this.$el, this)
    compiler.$el.appendChild(compiler.fragment)

    // 3、使用this代理$data
    for (let k in this.$data) {
      this.proxyData(this, k, this.$data[k])
    }
  }
  proxyData(vm, key, value) {
    Object.defineProperty(vm, key, {
      get() {
        return value
      },
      set(newVal) {
        value = newVal
      }
    })
  }
}
