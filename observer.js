const utils = {
  isObj(value) {
    return typeof value === 'object'
  }
}

// 观察者
class Watcher {
  constructor(vm, exp, cb) {
    this.vm = vm
    this.exp = exp
    this.cb = cb
    // 创建实例的时候获取一下以来对应的值
    this.getValue()
  }
  getValue() {
    // 把观察者存到Dep对象的静态属性target上
    Dep.target = this
    // 获取对应依赖的值，出来get函数，收集当前依赖
    compileUtils.getVal(this.exp, this.vm.$data)
    // 清空Dep对象的target属性，为下一次收集依赖做准备
    Dep.target = null
  }
  update() {
    // 触发缓存在依赖中的更新函数
    this.cb()
  }
}

// 依赖收集器
class Dep {
  constructor() {
    // 初始化收集器
    this.deps = []
  }
  add(dep) {
    // 收集依赖
    this.deps.push(dep)
  }
  notify() {
    // 通知收集到的依赖更新数据
    this.deps.map(w => w.update())
  }
}

class Observer {
  constructor(vm) {
    this.vm = vm
    // 遍历data属性
    this.getKeys(vm.$data)
  }
  getKeys(obj) {
    // 判断传入的值是否是对象，是对象再往下执行
    if (!utils.isObj(obj)) return

    for (let key in obj) {
      // 劫持属性
      this.observeDirect(obj, key, obj[key])
    }
  }
  observeDirect(obj, key, value) {
    // 递归子属性
    this.getKeys(value)

    let that = this
    // 创建收集器
    let dep = new Dep()
    Object.defineProperty(obj, key, {
      // 是否可枚举
      enumerable: true,
      // 是否可配置
      configurable: false,
      get() {
        // 判断Dep.target是否存在，存在的话收集该属性绑定的依赖
        Dep.target && dep.add(Dep.target)
        return value
      },
      set(newVal) {
        // 判断新旧值是否相同
        if (value !== newVal) {
          // 劫持新添加的对象
          that.getKeys(newVal)
          // 更新value
          value = newVal
          // 通知dep收集器更新依赖的数据
          dep.notify()
        }
      }
    })
  }
}
