import React, { useState, useMemo } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  const [otherState, setOtherState] = useState(0)

  // 使用 useMemo 缓存计算结果
  // 只有当 count 改变时才会重新计算
  const expensiveValue = useMemo(() => {
    console.log('正在计算昂贵的值...')
    return count * count
  }, [count])

  return (
    <div style={{ padding: '20px' }}>
      <h1>useMemo 简单示例</h1>

      <div>
        <p>计数: {count}</p>
        <p>计算结果 (count²): {expensiveValue}</p>
        <button onClick={() => setCount(count + 1)}>增加计数</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <p>其他状态: {otherState}</p>
        <button onClick={() => setOtherState(otherState + 1)}>
          增加其他状态
        </button>
      </div>

      <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        打开控制台查看：只有点击"增加计数"时才会重新计算，
        点击"增加其他状态"不会触发重新计算
      </p>
    </div>
  )
}
