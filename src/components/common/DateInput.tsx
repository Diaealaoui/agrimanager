import React, { useState } from 'react'
import { View, TextInput, TouchableOpacity, Platform } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { colors, globalStyles } from '../../utils/styles'

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function DateInput({ value, onChange, placeholder }: DateInputProps) {
  const [showPicker, setShowPicker] = useState(false)

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false)
    }

    if (event.type === 'dismissed') {
      return
    }

    if (selectedDate) {
      const isoDate = selectedDate.toISOString().split('T')[0]
      onChange(isoDate)
    }

    if (Platform.OS === 'ios') {
      setShowPicker(false)
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setShowPicker(true)} activeOpacity={0.8}>
        <View pointerEvents="none">
          <TextInput
            style={globalStyles.input}
            value={value}
            placeholder={placeholder}
            placeholderTextColor={colors.textLight}
            editable={false}
          />
        </View>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}
    </View>
  )
}