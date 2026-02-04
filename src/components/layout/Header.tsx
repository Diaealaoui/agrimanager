import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { typography, colors } from '../../utils/styles'
import Sidebar from './Sidebar'

interface HeaderProps {
  title: string
  showBack?: boolean
  rightComponent?: React.ReactNode
}

export default function Header({ title, showBack = false, rightComponent }: HeaderProps) {
  const navigation = useNavigation()
  const [sidebarVisible, setSidebarVisible] = useState(false)

  return (
    <>
      <View style={{
        backgroundColor: colors.primary,
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Menu Button */}
            <TouchableOpacity
              onPress={() => setSidebarVisible(true)}
              style={{ marginRight: 12 }}
            >
              <Text style={{ color: 'white', fontSize: 24 }}>☰</Text>
            </TouchableOpacity>
            
            {showBack && (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginRight: 12 }}
              >
                <Text style={{ color: 'white', fontSize: 24 }}>←</Text>
              </TouchableOpacity>
            )}
            <Text style={[typography.h1, { color: 'white' }]}>{title}</Text>
          </View>
          
          {rightComponent && (
            <View>{rightComponent}</View>
          )}
        </View>
      </View>
      
      <Sidebar 
        isVisible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </>
  )
}