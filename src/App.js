import React, { createContext, useContext, useState } from 'react'
import './App.css'

// 创建主题上下文
const ThemeContext = createContext()

// 主题提供者组件
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  return <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>
}

// 自定义hooks
function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// 头部组件
function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className={`header ${theme}`}>
      <h1>useContext 调试案例</h1>
      <div className="controls">
        <button onClick={toggleTheme}>
          切换到 {theme === 'light' ? '暗色' : '亮色'} 主题
        </button>
      </div>
    </header>
  )
}

// 内容组件
function Content() {
  const { theme } = useTheme()

  return (
    <main className={`content ${theme}`}>
      <h2>当前状态调试</h2>
      <div className="debug-info">
        <p>
          <strong>主题:</strong> {theme}
        </p>
      </div>
    </main>
  )
}

// 主应用组件
export default function App() {
  return (
    <ThemeProvider>
      <Header />
      <Content />
    </ThemeProvider>
  )
}
