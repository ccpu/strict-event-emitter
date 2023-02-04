import { MemoryLeakError } from './MemoryLeakError'
import {
  EventMap,
  Listener,
  ExternalInternalEventKeys,
  WithEventData,
  EventKeys,
  InternalListener,
  InternalEventKeys,
} from './typings'

/**
 * Node.js-compatible implementation of `EventEmitter`.
 *
 * @example
 * const emitter = new Emitter<{ hello: [string] }>()
 * emitter.on('hello', (name) => console.log(name))
 * emitter.emit('hello', 'John')
 */
export class Emitter<Events extends EventMap> {
  private events: Map<keyof Events, Array<Listener<any>>>
  private maxListeners: number
  private hasWarnedAboutPotentialMemoryLeak: boolean

  static defaultMaxListeners = 10

  static listenerCount<Events extends EventMap>(
    emitter: Emitter<EventMap>,
    eventName: keyof Events
  ): number {
    return emitter.listenerCount<any>(eventName)
  }

  constructor() {
    this.events = new Map()
    this.maxListeners = Emitter.defaultMaxListeners
    this.hasWarnedAboutPotentialMemoryLeak = false
  }

  private _emitInternalEvent(
    internalEventName: InternalEventKeys<Events>,
    eventName: EventKeys<Events>,
    listener: Listener<Array<unknown>>
  ): void {
    this.emit(
      internalEventName,
      // Anything to make TypeScript happy.
      ...([eventName, listener] as any)
    )
  }

  private _getListeners<EventName extends keyof Events>(
    eventName: EventName
  ): Array<Listener<Array<unknown>>> {
    return this.events.get(eventName) || []
  }

  private _removeListener<EventName extends keyof Events>(
    listeners: Array<Listener<WithEventData<Events, EventName>>>,
    listener: Listener<WithEventData<Events, EventName>>
  ): Array<Listener<WithEventData<Events, EventName>>> {
    const index = listeners.indexOf(listener)

    if (index > -1) {
      listeners.splice(index, 1)
    }

    return []
  }

  private _wrapOnceListener<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): Listener<WithEventData<Events, EventName>> {
    const onceListener = (...data: WithEventData<Events, EventName>) => {
      this.removeListener(eventName, onceListener)
      listener.apply(this, data)
    }

    return onceListener
  }

  public setMaxListeners(maxListeners: number): this {
    this.maxListeners = maxListeners
    return this
  }

  /**
   * Returns the current max listener value for the `Emitter` which is
   * either set by `emitter.setMaxListeners(n)` or defaults to
   * `Emitter.defaultMaxListeners`.
   */
  public getMaxListeners(): number {
    return this.maxListeners
  }

  /**
   * Returns an array listing the events for which the emitter has registered listeners.
   * The values in the array will be strings or Symbols.
   */
  public eventNames(): Array<keyof Events> {
    return Array.from(this.events.keys())
  }

  /**
   * Synchronously calls each of the listeners registered for the event named `eventName`,
   * in the order they were registered, passing the supplied arguments to each.
   * Returns `true` if the event has listeners, `false` otherwise.
   *
   * @example
   * const emitter = new Emitter<{ hello: [string] }>()
   * emitter.emit('hello', 'John')
   */
  public emit<EventName extends ExternalInternalEventKeys<Events>>(
    eventName: EventName,
    ...data: WithEventData<Events, EventName>
  ): boolean {
    const listeners = this._getListeners(eventName)
    listeners.forEach((listener) => {
      listener.apply(this, data)
    })

    return listeners.length > 0
  }

  public addListener(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public addListener<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  public addListener(
    eventName: ExternalInternalEventKeys<Events>,
    listener: InternalListener<Events> | Listener<WithEventData<Events, any>>
  ): this {
    // Emit the `newListener` event before adding the listener.
    this._emitInternalEvent('newListener', eventName, listener)

    const nextListeners = this._getListeners(eventName).concat(listener)
    this.events.set(eventName, nextListeners)

    if (
      this.maxListeners > 0 &&
      this.listenerCount(eventName) > this.maxListeners &&
      !this.hasWarnedAboutPotentialMemoryLeak
    ) {
      this.hasWarnedAboutPotentialMemoryLeak = true

      const memoryLeakWarning = new MemoryLeakError(
        this,
        eventName,
        this.listenerCount(eventName)
      )
      console.warn(memoryLeakWarning)
    }

    return this
  }

  public on(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public on<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  public on<EventName extends ExternalInternalEventKeys<Events>>(
    eventName: EventName,
    listener: any
  ): this {
    return this.addListener(eventName, listener)
  }

  public once(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public once<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  public once<EventName extends ExternalInternalEventKeys<Events>>(
    eventName: EventName,
    listener: any
  ): this {
    return this.addListener(
      eventName,
      this._wrapOnceListener(eventName, listener)
    )
  }

  public prependListener(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public prependListener<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  public prependListener<EventName extends ExternalInternalEventKeys<Events>>(
    eventName: EventName,
    listener: any
  ): this {
    const listeners = this._getListeners(eventName)

    if (listeners.length > 0) {
      const nextListeners = [listener].concat(listeners)
      this.events.set(eventName, nextListeners)
    } else {
      this.events.set(eventName, listeners.concat(listener))
    }

    return this
  }

  public prependOnceListener(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public prependOnceListener<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  public prependOnceListener<
    EventName extends ExternalInternalEventKeys<Events>
  >(eventName: EventName, listener: any): this {
    return this.prependListener(
      eventName,
      this._wrapOnceListener(eventName, listener)
    )
  }

  public removeListener(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public removeListener<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  public removeListener<EventName extends ExternalInternalEventKeys<Events>>(
    eventName: EventName,
    listener: any
  ): this {
    const listeners = this._getListeners(eventName)

    if (listeners.length > 0) {
      this._removeListener(listeners, listener)
      this.events.set(eventName, listeners)

      // Emit the `removeListener` event after removing the listener.
      this._emitInternalEvent('removeListener', eventName, listener)
    }

    return this
  }

  public off(
    eventName: InternalEventKeys<Events>,
    listener: InternalListener<Events>
  ): this
  public off<EventName extends EventKeys<Events>>(
    eventName: EventName,
    listener: Listener<WithEventData<Events, EventName>>
  ): this
  /**
   * Alias for `emitter.removeListener()`.
   *
   * @example
   * emitter.off('hello', listener)
   */
  public off<EventName extends ExternalInternalEventKeys<Events>>(
    eventName: EventName,
    listener: any
  ): this {
    return this.removeListener(eventName, listener)
  }

  public removeAllListeners(eventName?: InternalEventKeys<Events>): this
  public removeAllListeners<EventName extends EventKeys<Events>>(
    eventName?: EventName
  ): this
  public removeAllListeners(
    eventName?: InternalEventKeys<Events> | EventKeys<Events>
  ): this {
    if (eventName) {
      this.events.delete(eventName)
    } else {
      this.events.clear()
    }

    return this
  }

  public listeners(eventName: InternalEventKeys<Events>): Array<Listener<any>>
  public listeners<EventName extends EventKeys<Events>>(
    eventName: EventName
  ): Array<Listener<WithEventData<Events, EventName>>>
  /**
   * Returns a copy of the array of listeners for the event named `eventName`.
   */
  public listeners(eventName: InternalEventKeys<Events> | EventKeys<Events>) {
    return Array.from(this._getListeners(eventName))
  }

  public listenerCount(eventName: InternalEventKeys<Events>): number
  public listenerCount<EventName extends EventKeys<Events>>(
    eventName: EventName
  ): number
  /**
   * Returns the number of listeners listening to the event named `eventName`.
   */
  public listenerCount(
    eventName: InternalEventKeys<Events> | EventKeys<Events>
  ): number {
    return this._getListeners(eventName).length
  }

  public rawListeners<EventName extends EventKeys<Events>>(
    eventName: EventName
  ): Array<Listener<WithEventData<Events, EventName>>> {
    return this.listeners(eventName)
  }
}
