import React, { useState, useCallback } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => {
    setCount(prevCount => prevCount + 1)
  }, [])

  return (
    <div>
      <h1>useCallback Demo</h1>
      <p>Count: {count}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  )
}
