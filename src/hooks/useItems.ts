import { useContext } from 'react'
import { ItemsContext } from '../app/items-context'

export function useItems() {
  const context = useContext(ItemsContext)

  if (!context) {
    throw new Error('useItems must be used inside ItemsProvider.')
  }

  return context
}
