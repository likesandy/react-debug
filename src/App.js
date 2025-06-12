// import React, { useState, useRef, forwardRef } from 'react'

// // 一个可以感知自身大小的组件
// const ResizableBox = forwardRef((props, ref) => {
//   const [size, setSize] = useState({ width: 0, height: 0 })
//   const [count, setCount] = useState(0)

//   // 使用 ref 回调函数
//   const measuredRef = node => {
//     // 当 node 为 null 时（组件卸载时），我们不需要做任何事
//     // 因为清理函数会处理
//     if (node === null) {
//       return
//     }

//     // 【核心】返回一个清理函数
//     // 这个函数会在组件卸载时被调用
//     return () => {
//       console.log('清理 ref：断开 ResizeObserver')
//     }
//   }

//   return (
//     <div
//       ref={measuredRef}
//       style={{
//         width: '200px',
//         height: '100px',
//         resize: 'both', // 允许用户通过拖动右下角来调整大小
//         overflow: 'auto',
//         border: '2px solid #ccc',
//         padding: '10px',
//         position: 'relative'
//       }}
//     >
//       <p>拖动右下角来改变我的大小。</p>
//       <p>
//         当前尺寸: {size.width}px &times; {size.height}px
//       </p>
//       <div
//         style={{
//           position: 'absolute',
//           bottom: 0,
//           right: 0,
//           width: '10px',
//           height: '10px',
//           cursor: 'nwse-resize',
//           backgroundColor: '#999'
//         }}
//       />

//       <button
//         onClick={() => {
//           setCount(count + 1)
//         }}
//       >
//         click
//       </button>
//     </div>
//   )
// })

// // 父组件
// export default function App() {
//   const [show, setShow] = useState(true)
//   const ref = useRef(null)

//   return (
//     <div style={{ padding: '20px' }}>
//       <h1>React 19 ref 清理函数示例</h1>
//       <p>
//         下面的组件使用了 <code>ResizeObserver</code> 来监听自身的尺寸变化。
//       </p>
//       <p>
//         当组件挂载时，<code>ref</code> 回调函数会创建并启动
//         <code>ResizeObserver</code>。当组件卸载时（点击下方按钮），
//         <code>ref</code>
//         回调返回的清理函数会被执行，从而断开 observer。
//       </p>
//       <button
//         onClick={() => setShow(!show)}
//         style={{ marginBottom: '20px' }}
//       >
//         {show ? '卸载组件' : '挂载组件'}
//       </button>

//       <hr />

//       {show && <ResizableBox ref={ref} />}
//     </div>
//   )
// }

import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react'

export default function App() {
  const inputRef = useRef(null)
  const [show, setShow] = useState(true)
  const handleFocus = () => {
    inputRef.current?.focus()
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>useImperativeHandle Input Focus Demo</h1>
      {show && <CustomInput ref={inputRef} />}
      <button
        onClick={handleFocus}
        style={{ marginLeft: '10px' }}
      >
        聚焦输入框
      </button>
      <button onClick={() => setShow(!show)}>
        {show ? '卸载组件' : '挂载组件'}
      </button>
    </div>
  )
}

// 使用 forwardRef 和 useImperativeHandle 的自定义输入组件
const CustomInput = forwardRef((props, ref) => {
  const inputRef = useRef(null)

  // 使用 useImperativeHandle 暴露自定义的方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus()
      }
    }),
    []
  )

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="点击按钮可以聚焦到这里"
      style={{
        padding: '8px',
        fontSize: '16px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}
    />
  )
})
