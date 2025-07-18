/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  Fiber,
  FiberRoot,
  SuspenseHydrationCallbacks,
  TransitionTracingCallbacks
} from './ReactInternalTypes'
import type { RootTag } from './ReactRootTags'
import type {
  Instance,
  TextInstance,
  Container,
  PublicInstance,
  RendererInspectionConfig
} from './ReactFiberConfig'
import type { ReactNodeList, ReactFormState } from 'shared/ReactTypes'
import type { Lane } from './ReactFiberLane'
import type { SuspenseState } from './ReactFiberSuspenseComponent'

import { LegacyRoot } from './ReactRootTags'
import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals
} from './ReactFiberTreeReflection'
import { get as getInstance } from 'shared/ReactInstanceMap'
import {
  HostComponent,
  HostSingleton,
  ClassComponent,
  HostRoot,
  SuspenseComponent
} from './ReactWorkTags'
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber'
import isArray from 'shared/isArray'
import { enableSchedulingProfiler } from 'shared/ReactFeatureFlags'
import ReactSharedInternals from 'shared/ReactSharedInternals'
import { getPublicInstance } from './ReactFiberConfig'
import {
  findCurrentUnmaskedContext,
  processChildContext,
  emptyContextObject,
  isContextProvider as isLegacyContextProvider
} from './ReactFiberContext'
import { createFiberRoot } from './ReactFiberRoot'
import { isRootDehydrated } from './ReactFiberShellHydration'
import {
  injectInternals,
  markRenderScheduled,
  onScheduleRoot
} from './ReactFiberDevToolsHook'
import {
  requestUpdateLane,
  scheduleUpdateOnFiber,
  scheduleInitialHydrationOnRoot,
  flushRoot,
  batchedUpdates,
  flushSyncFromReconciler,
  flushSyncWork,
  isAlreadyRendering,
  deferredUpdates,
  discreteUpdates,
  flushPassiveEffects
} from './ReactFiberWorkLoop'
import { enqueueConcurrentRenderForLane } from './ReactFiberConcurrentUpdates'
import {
  createUpdate,
  enqueueUpdate,
  entangleTransitions
} from './ReactFiberClassUpdateQueue'
import {
  isRendering as ReactCurrentFiberIsRendering,
  current as ReactCurrentFiberCurrent,
  runWithFiberInDEV
} from './ReactCurrentFiber'
import { StrictLegacyMode } from './ReactTypeOfMode'
import {
  SyncLane,
  SelectiveHydrationLane,
  getHighestPriorityPendingLanes,
  higherPriorityLane
} from './ReactFiberLane'
import {
  scheduleRefresh,
  scheduleRoot,
  setRefreshHandler,
  findHostInstancesForRefresh
} from './ReactFiberHotReloading'
import ReactVersion from 'shared/ReactVersion'
export { createPortal } from './ReactPortal'
export {
  createComponentSelector,
  createHasPseudoClassSelector,
  createRoleSelector,
  createTestNameSelector,
  createTextSelector,
  getFindAllNodesFailureDescription,
  findAllNodes,
  findBoundingRects,
  focusWithin,
  observeVisibleRects
} from './ReactTestSelectors'
export { startHostTransition } from './ReactFiberHooks'
export {
  defaultOnUncaughtError,
  defaultOnCaughtError,
  defaultOnRecoverableError
} from './ReactFiberErrorLogger'

type OpaqueRoot = FiberRoot

// 0 is PROD, 1 is DEV.
// Might add PROFILE later.
type BundleType = 0 | 1

type DevToolsConfig = {
  bundleType: BundleType,
  version: string,
  rendererPackageName: string,
  // Note: this actually *does* depend on Fiber internal fields.
  // Used by "inspect clicked DOM element" in React DevTools.
  findFiberByHostInstance?: (instance: Instance | TextInstance) => Fiber | null,
  rendererConfig?: RendererInspectionConfig
}

let didWarnAboutNestedUpdates
let didWarnAboutFindNodeInStrictMode

if (__DEV__) {
  didWarnAboutNestedUpdates = false
  didWarnAboutFindNodeInStrictMode = ({}: { [string]: boolean })
}

function getContextForSubtree(
  parentComponent: ?React$Component<any, any>
): Object {
  if (!parentComponent) {
    return emptyContextObject
  }

  const fiber = getInstance(parentComponent)
  const parentContext = findCurrentUnmaskedContext(fiber)

  if (fiber.tag === ClassComponent) {
    const Component = fiber.type
    if (isLegacyContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext)
    }
  }

  return parentContext
}

function findHostInstance(component: Object): PublicInstance | null {
  const fiber = getInstance(component)
  if (fiber === undefined) {
    if (typeof component.render === 'function') {
      throw new Error('Unable to find node on an unmounted component.')
    } else {
      const keys = Object.keys(component).join(',')
      throw new Error(
        `Argument appears to not be a ReactComponent. Keys: ${keys}`
      )
    }
  }
  const hostFiber = findCurrentHostFiber(fiber)
  if (hostFiber === null) {
    return null
  }
  return getPublicInstance(hostFiber.stateNode)
}

function findHostInstanceWithWarning(
  component: Object,
  methodName: string
): PublicInstance | null {
  if (__DEV__) {
    const fiber = getInstance(component)
    if (fiber === undefined) {
      if (typeof component.render === 'function') {
        throw new Error('Unable to find node on an unmounted component.')
      } else {
        const keys = Object.keys(component).join(',')
        throw new Error(
          `Argument appears to not be a ReactComponent. Keys: ${keys}`
        )
      }
    }
    const hostFiber = findCurrentHostFiber(fiber)
    if (hostFiber === null) {
      return null
    }
    if (hostFiber.mode & StrictLegacyMode) {
      const componentName = getComponentNameFromFiber(fiber) || 'Component'
      if (!didWarnAboutFindNodeInStrictMode[componentName]) {
        didWarnAboutFindNodeInStrictMode[componentName] = true
        runWithFiberInDEV(hostFiber, () => {
          if (fiber.mode & StrictLegacyMode) {
            console.error(
              '%s is deprecated in StrictMode. ' +
                '%s was passed an instance of %s which is inside StrictMode. ' +
                'Instead, add a ref directly to the element you want to reference. ' +
                'Learn more about using refs safely here: ' +
                'https://react.dev/link/strict-mode-find-node',
              methodName,
              methodName,
              componentName
            )
          } else {
            console.error(
              '%s is deprecated in StrictMode. ' +
                '%s was passed an instance of %s which renders StrictMode children. ' +
                'Instead, add a ref directly to the element you want to reference. ' +
                'Learn more about using refs safely here: ' +
                'https://react.dev/link/strict-mode-find-node',
              methodName,
              methodName,
              componentName
            )
          }
        })
      }
    }
    return getPublicInstance(hostFiber.stateNode)
  }
  return findHostInstance(component)
}

export function createContainer(
  containerInfo: Container,
  tag: RootTag,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  // TODO: Remove `concurrentUpdatesByDefaultOverride`. It is now ignored.
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
  onUncaughtError: (
    error: mixed,
    errorInfo: { +componentStack?: ?string }
  ) => void,
  onCaughtError: (
    error: mixed,
    errorInfo: {
      +componentStack?: ?string,
      +errorBoundary?: ?React$Component<any, any>
    }
  ) => void,
  onRecoverableError: (
    error: mixed,
    errorInfo: { +componentStack?: ?string }
  ) => void,
  transitionCallbacks: null | TransitionTracingCallbacks
): OpaqueRoot {
  const hydrate = false
  const initialChildren = null
  return createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    identifierPrefix,
    onUncaughtError,
    onCaughtError,
    onRecoverableError,
    transitionCallbacks,
    null
  )
}

export function createHydrationContainer(
  initialChildren: ReactNodeList,
  // TODO: Remove `callback` when we delete legacy mode.
  callback: ?Function,
  containerInfo: Container,
  tag: RootTag,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  // TODO: Remove `concurrentUpdatesByDefaultOverride`. It is now ignored.
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
  onUncaughtError: (
    error: mixed,
    errorInfo: { +componentStack?: ?string }
  ) => void,
  onCaughtError: (
    error: mixed,
    errorInfo: {
      +componentStack?: ?string,
      +errorBoundary?: ?React$Component<any, any>
    }
  ) => void,
  onRecoverableError: (
    error: mixed,
    errorInfo: { +componentStack?: ?string }
  ) => void,
  transitionCallbacks: null | TransitionTracingCallbacks,
  formState: ReactFormState<any, any> | null
): OpaqueRoot {
  const hydrate = true
  const root = createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    identifierPrefix,
    onUncaughtError,
    onCaughtError,
    onRecoverableError,
    transitionCallbacks,
    formState
  )

  // TODO: Move this to FiberRoot constructor
  root.context = getContextForSubtree(null)

  // Schedule the initial render. In a hydration root, this is different from
  // a regular update because the initial render must match was was rendered
  // on the server.
  // NOTE: This update intentionally doesn't have a payload. We're only using
  // the update to schedule work on the root fiber (and, for legacy roots, to
  // enqueue the callback if one is provided).
  const current = root.current
  const lane = requestUpdateLane(current)
  const update = createUpdate(lane)
  update.callback =
    callback !== undefined && callback !== null ? callback : null
  enqueueUpdate(current, update, lane)
  scheduleInitialHydrationOnRoot(root, lane)

  return root
}

export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function
): Lane {
  // container--->fiberRoot; rootFiber：src/react/packages/react-reconciler/src/ReactFiberRoot.js:46；fiberRoot.current = rootFiber;rootFiber.stateNode = fiberRoot；
  const current = container.current
  const lane = requestUpdateLane(current)
  updateContainerImpl(
    current,
    lane,
    element,
    container,
    parentComponent,
    callback
  )
  return lane
}

export function updateContainerSync(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function
): Lane {
  if (container.tag === LegacyRoot) {
    flushPassiveEffects()
  }
  const current = container.current
  updateContainerImpl(
    current,
    SyncLane,
    element,
    container,
    parentComponent,
    callback
  )
  return SyncLane
}

function updateContainerImpl(
  rootFiber: Fiber,
  lane: Lane,
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function
): void {
  if (__DEV__) {
    onScheduleRoot(container, element)
  }

  if (enableSchedulingProfiler) {
    markRenderScheduled(lane)
  }
  // 如果是子组件则通过父组件获取子组件上下文，首次调用render的时候parentComponent为null，所以此时context = {}
  const context = getContextForSubtree(parentComponent)
  if (container.context === null) {
    container.context = context
  } else {
    container.pendingContext = context
  }
  // 结合优先级创建一个update
  const update = createUpdate(lane)
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element }

  callback = callback === undefined ? null : callback
  if (callback !== null) {
    update.callback = callback
  }

  // TODO：concurrentQueues
  const root = enqueueUpdate(rootFiber, update, lane)
  if (root !== null) {
    scheduleUpdateOnFiber(root, rootFiber, lane)
    entangleTransitions(root, rootFiber, lane)
  }
}

export {
  batchedUpdates,
  deferredUpdates,
  discreteUpdates,
  flushSyncFromReconciler,
  flushSyncWork,
  isAlreadyRendering,
  flushPassiveEffects
}

export function getPublicRootInstance(
  container: OpaqueRoot
): React$Component<any, any> | PublicInstance | null {
  const containerFiber = container.current
  if (!containerFiber.child) {
    return null
  }
  switch (containerFiber.child.tag) {
    case HostSingleton:
    case HostComponent:
      return getPublicInstance(containerFiber.child.stateNode)
    default:
      return containerFiber.child.stateNode
  }
}

export function attemptSynchronousHydration(fiber: Fiber): void {
  switch (fiber.tag) {
    case HostRoot: {
      const root: FiberRoot = fiber.stateNode
      if (isRootDehydrated(root)) {
        // Flush the first scheduled "update".
        const lanes = getHighestPriorityPendingLanes(root)
        flushRoot(root, lanes)
      }
      break
    }
    case SuspenseComponent: {
      const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane)
      }
      flushSyncWork()
      // If we're still blocked after this, we need to increase
      // the priority of any promises resolving within this
      // boundary so that they next attempt also has higher pri.
      const retryLane = SyncLane
      markRetryLaneIfNotHydrated(fiber, retryLane)
      break
    }
  }
}

function markRetryLaneImpl(fiber: Fiber, retryLane: Lane) {
  const suspenseState: null | SuspenseState = fiber.memoizedState
  if (suspenseState !== null && suspenseState.dehydrated !== null) {
    suspenseState.retryLane = higherPriorityLane(
      suspenseState.retryLane,
      retryLane
    )
  }
}

// Increases the priority of thenables when they resolve within this boundary.
function markRetryLaneIfNotHydrated(fiber: Fiber, retryLane: Lane) {
  markRetryLaneImpl(fiber, retryLane)
  const alternate = fiber.alternate
  if (alternate) {
    markRetryLaneImpl(alternate, retryLane)
  }
}

export function attemptContinuousHydration(fiber: Fiber): void {
  if (fiber.tag !== SuspenseComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority and they should not suspend on I/O,
    // since you have to wrap anything that might suspend in
    // Suspense.
    return
  }
  const lane = SelectiveHydrationLane
  const root = enqueueConcurrentRenderForLane(fiber, lane)
  if (root !== null) {
    scheduleUpdateOnFiber(root, fiber, lane)
  }
  markRetryLaneIfNotHydrated(fiber, lane)
}

export function attemptHydrationAtCurrentPriority(fiber: Fiber): void {
  if (fiber.tag !== SuspenseComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority other than synchronously flush it.
    return
  }
  const lane = requestUpdateLane(fiber)
  const root = enqueueConcurrentRenderForLane(fiber, lane)
  if (root !== null) {
    scheduleUpdateOnFiber(root, fiber, lane)
  }
  markRetryLaneIfNotHydrated(fiber, lane)
}

export { findHostInstance }

export { findHostInstanceWithWarning }

export function findHostInstanceWithNoPortals(
  fiber: Fiber
): PublicInstance | null {
  const hostFiber = findCurrentHostFiberWithNoPortals(fiber)
  if (hostFiber === null) {
    return null
  }
  return getPublicInstance(hostFiber.stateNode)
}

let shouldErrorImpl: Fiber => ?boolean = fiber => null

export function shouldError(fiber: Fiber): ?boolean {
  return shouldErrorImpl(fiber)
}

let shouldSuspendImpl = (fiber: Fiber) => false

export function shouldSuspend(fiber: Fiber): boolean {
  return shouldSuspendImpl(fiber)
}

let overrideHookState = null
let overrideHookStateDeletePath = null
let overrideHookStateRenamePath = null
let overrideProps = null
let overridePropsDeletePath = null
let overridePropsRenamePath = null
let scheduleUpdate = null
let setErrorHandler = null
let setSuspenseHandler = null

if (__DEV__) {
  const copyWithDeleteImpl = (
    obj: Object | Array<any>,
    path: Array<string | number>,
    index: number
  ): $FlowFixMe => {
    const key = path[index]
    const updated = isArray(obj) ? obj.slice() : { ...obj }
    if (index + 1 === path.length) {
      if (isArray(updated)) {
        updated.splice(((key: any): number), 1)
      } else {
        delete updated[key]
      }
      return updated
    }
    // $FlowFixMe[incompatible-use] number or string is fine here
    updated[key] = copyWithDeleteImpl(obj[key], path, index + 1)
    return updated
  }

  const copyWithDelete = (
    obj: Object | Array<any>,
    path: Array<string | number>
  ): Object | Array<any> => {
    return copyWithDeleteImpl(obj, path, 0)
  }

  const copyWithRenameImpl = (
    obj: Object | Array<any>,
    oldPath: Array<string | number>,
    newPath: Array<string | number>,
    index: number
  ): $FlowFixMe => {
    const oldKey = oldPath[index]
    const updated = isArray(obj) ? obj.slice() : { ...obj }
    if (index + 1 === oldPath.length) {
      const newKey = newPath[index]
      // $FlowFixMe[incompatible-use] number or string is fine here
      updated[newKey] = updated[oldKey]
      if (isArray(updated)) {
        updated.splice(((oldKey: any): number), 1)
      } else {
        delete updated[oldKey]
      }
    } else {
      // $FlowFixMe[incompatible-use] number or string is fine here
      updated[oldKey] = copyWithRenameImpl(
        // $FlowFixMe[incompatible-use] number or string is fine here
        obj[oldKey],
        oldPath,
        newPath,
        index + 1
      )
    }
    return updated
  }

  const copyWithRename = (
    obj: Object | Array<any>,
    oldPath: Array<string | number>,
    newPath: Array<string | number>
  ): Object | Array<any> => {
    if (oldPath.length !== newPath.length) {
      console.warn('copyWithRename() expects paths of the same length')
      return
    } else {
      for (let i = 0; i < newPath.length - 1; i++) {
        if (oldPath[i] !== newPath[i]) {
          console.warn(
            'copyWithRename() expects paths to be the same except for the deepest key'
          )
          return
        }
      }
    }
    return copyWithRenameImpl(obj, oldPath, newPath, 0)
  }

  const copyWithSetImpl = (
    obj: Object | Array<any>,
    path: Array<string | number>,
    index: number,
    value: any
  ): $FlowFixMe => {
    if (index >= path.length) {
      return value
    }
    const key = path[index]
    const updated = isArray(obj) ? obj.slice() : { ...obj }
    // $FlowFixMe[incompatible-use] number or string is fine here
    updated[key] = copyWithSetImpl(obj[key], path, index + 1, value)
    return updated
  }

  const copyWithSet = (
    obj: Object | Array<any>,
    path: Array<string | number>,
    value: any
  ): Object | Array<any> => {
    return copyWithSetImpl(obj, path, 0, value)
  }

  const findHook = (fiber: Fiber, id: number) => {
    // For now, the "id" of stateful hooks is just the stateful hook index.
    // This may change in the future with e.g. nested hooks.
    let currentHook = fiber.memoizedState
    while (currentHook !== null && id > 0) {
      currentHook = currentHook.next
      id--
    }
    return currentHook
  }

  // Support DevTools editable values for useState and useReducer.
  overrideHookState = (
    fiber: Fiber,
    id: number,
    path: Array<string | number>,
    value: any
  ) => {
    const hook = findHook(fiber, id)
    if (hook !== null) {
      const newState = copyWithSet(hook.memoizedState, path, value)
      hook.memoizedState = newState
      hook.baseState = newState

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps }

      const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane)
      }
    }
  }
  overrideHookStateDeletePath = (
    fiber: Fiber,
    id: number,
    path: Array<string | number>
  ) => {
    const hook = findHook(fiber, id)
    if (hook !== null) {
      const newState = copyWithDelete(hook.memoizedState, path)
      hook.memoizedState = newState
      hook.baseState = newState

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps }

      const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane)
      }
    }
  }
  overrideHookStateRenamePath = (
    fiber: Fiber,
    id: number,
    oldPath: Array<string | number>,
    newPath: Array<string | number>
  ) => {
    const hook = findHook(fiber, id)
    if (hook !== null) {
      const newState = copyWithRename(hook.memoizedState, oldPath, newPath)
      hook.memoizedState = newState
      hook.baseState = newState

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps }

      const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane)
      }
    }
  }

  // Support DevTools props for function components, forwardRef, memo, host components, etc.
  overrideProps = (fiber: Fiber, path: Array<string | number>, value: any) => {
    fiber.pendingProps = copyWithSet(fiber.memoizedProps, path, value)
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps
    }
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane)
    }
  }
  overridePropsDeletePath = (fiber: Fiber, path: Array<string | number>) => {
    fiber.pendingProps = copyWithDelete(fiber.memoizedProps, path)
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps
    }
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane)
    }
  }
  overridePropsRenamePath = (
    fiber: Fiber,
    oldPath: Array<string | number>,
    newPath: Array<string | number>
  ) => {
    fiber.pendingProps = copyWithRename(fiber.memoizedProps, oldPath, newPath)
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps
    }
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane)
    }
  }

  scheduleUpdate = (fiber: Fiber) => {
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane)
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane)
    }
  }

  setErrorHandler = (newShouldErrorImpl: Fiber => ?boolean) => {
    shouldErrorImpl = newShouldErrorImpl
  }

  setSuspenseHandler = (newShouldSuspendImpl: Fiber => boolean) => {
    shouldSuspendImpl = newShouldSuspendImpl
  }
}

function findHostInstanceByFiber(fiber: Fiber): Instance | TextInstance | null {
  const hostFiber = findCurrentHostFiber(fiber)
  if (hostFiber === null) {
    return null
  }
  return hostFiber.stateNode
}

function emptyFindFiberByHostInstance(
  instance: Instance | TextInstance
): Fiber | null {
  return null
}

function getCurrentFiberForDevTools() {
  return ReactCurrentFiberCurrent
}

export function injectIntoDevTools(devToolsConfig: DevToolsConfig): boolean {
  const { findFiberByHostInstance } = devToolsConfig

  return injectInternals({
    bundleType: devToolsConfig.bundleType,
    version: devToolsConfig.version,
    rendererPackageName: devToolsConfig.rendererPackageName,
    rendererConfig: devToolsConfig.rendererConfig,
    overrideHookState,
    overrideHookStateDeletePath,
    overrideHookStateRenamePath,
    overrideProps,
    overridePropsDeletePath,
    overridePropsRenamePath,
    setErrorHandler,
    setSuspenseHandler,
    scheduleUpdate,
    currentDispatcherRef: ReactSharedInternals,
    findHostInstanceByFiber,
    findFiberByHostInstance:
      findFiberByHostInstance || emptyFindFiberByHostInstance,
    // React Refresh
    findHostInstancesForRefresh: __DEV__ ? findHostInstancesForRefresh : null,
    scheduleRefresh: __DEV__ ? scheduleRefresh : null,
    scheduleRoot: __DEV__ ? scheduleRoot : null,
    setRefreshHandler: __DEV__ ? setRefreshHandler : null,
    // Enables DevTools to append owner stacks to error messages in DEV mode.
    getCurrentFiber: __DEV__ ? getCurrentFiberForDevTools : null,
    // Enables DevTools to detect reconciler version rather than renderer version
    // which may not match for third party renderers.
    reconcilerVersion: ReactVersion
  })
}
