import React from 'react'
import { View, Text } from 'react-native'
import { globalStyles, typography } from '../../utils/styles'

interface MetricCardProps {
  title: string
  value: string | number
  icon?: string
  color?: string
}

export default function MetricCard({ title, value, icon, color = '#3b82f6' }: MetricCardProps) {
  return (
    <View style={globalStyles.metricCard}>
      {icon && <Text style={{ fontSize: 24, marginBottom: 8 }}>{icon}</Text>}
      <Text style={[typography.small, { color: '#6c757d', marginBottom: 4 }]}>{title}</Text>
      <Text style={[typography.h3, { color }]}>{value}</Text>
    </View>
  )
}