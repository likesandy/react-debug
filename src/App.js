import React, { createContext, useContext, useState } from 'react'
import './App.css'

// 主应用组件
export default function App() {
  const [count, setCount] = useState(0)
  return (
    // [count,count+]
    <CountContext.Provider value={{ count, setCount }}>
      <CountContext.Provider value={{ count: count + 1, setCount }}>
        <Header />
      </CountContext.Provider>
      <Content />
    </CountContext.Provider>
  )
}

// 创建主题上下文
const CountContext = createContext()

// 头部组件
function Header() {
  const { count, setCount } = useContext(CountContext)

  return (
    <header className={`header ${count}`}>
      <h1>useContext 调试案例</h1>
      <div className="controls">
        <button onClick={() => setCount(count + 1)}> {count} </button>
      </div>
    </header>
  )
}

// 内容组件
function Content() {
  const { count, setCount } = useContext(CountContext)

  return (
    <main className={`content ${count}`}>
      <h2>当前状态调试</h2>
      <div className="debug-info">
        <button onClick={() => setCount(count + 1)}> {count} </button>
      </div>
    </main>
  )
}
