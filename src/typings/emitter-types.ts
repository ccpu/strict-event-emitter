import { LiteralUnion } from './literal-union'

export type Listener<Data extends Array<unknown>> = (...data: Data) => void

export type EventMap = {
  [eventName: string]: Array<unknown>
}

export type InternalEventNames = 'newListener' | 'removeListener'

export type InternalListener<Events extends EventMap> = Listener<
  [eventName: keyof Events, listener: Listener<Array<unknown>>]
>

export interface InternalEvents<Events extends EventMap> {
  newListener: InternalListener<Events>
  removeListener: InternalListener<Events>
}

type InternalExternalEvents<Events extends EventMap> = Events &
  InternalEvents<Events>

export type ExternalInternalEventKeys<Events extends EventMap> = LiteralUnion<
  keyof InternalExternalEvents<Events>,
  string
>

export type EventKeys<Events extends EventMap> = LiteralUnion<
  keyof Events,
  string
>

export type InternalEventKeys<Events extends EventMap> =
  keyof InternalEvents<Events>

export type WithEventData<
  Events extends EventMap,
  EventName
> = EventName extends ExternalInternalEventKeys<Events>
  ? InternalExternalEvents<Events>[EventName]
  : unknown[]
