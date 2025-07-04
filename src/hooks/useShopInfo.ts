import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'


export function useShopInfo(userEmail: string | null | undefined) {
  const [shopInfo, setShopInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userEmail) {
      setLoading(false)
      return
    }

    async function fetchShopInfo() {
      try {
        setLoading(true)
        
        const { data, error } = await supabase
          .from('shop_accounts')
          .select('*')
          .eq('email', userEmail)
          .single()
          
        if (error) throw error
        
        setShopInfo(data)
      } catch (err) {
        console.error('Error fetching shop info:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    fetchShopInfo()
  }, [userEmail])

  return { shopInfo, loading, error }
}