import { useEffect, useState } from 'react'
import {
  canSearchQueryBenefitFromTransliteration,
  getSearchRuntimeVersion,
  loadSearchTransliteration,
  scheduleSearchTransliterationWarmup,
  subscribeSearchRuntime,
} from '../lib/search-index'

export function useSearchRuntime(query?: string) {
  const [runtimeVersion, setRuntimeVersion] = useState(() => getSearchRuntimeVersion())

  useEffect(() => {
    return subscribeSearchRuntime(() => {
      setRuntimeVersion(getSearchRuntimeVersion())
    })
  }, [])

  useEffect(() => {
    if (query?.trim()) {
      if (canSearchQueryBenefitFromTransliteration(query)) {
        void loadSearchTransliteration()
      }
      return () => undefined
    }

    return scheduleSearchTransliterationWarmup()
  }, [query])

  return runtimeVersion
}
