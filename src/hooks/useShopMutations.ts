import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useShopMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateShopInfo = async (shopId: string, updates: any) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shopId)
        .select()
        .single()
        
      if (error) throw error
      
      return data
    } catch (err) {
      console.error('Error updating shop info:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      return null
    } finally {
      setLoading(false)
    }
  }

  return { 
    updateShopInfo,
    loading,
    error
  }
}