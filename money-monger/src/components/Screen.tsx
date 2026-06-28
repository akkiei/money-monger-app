import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { common } from '../styles/common';
import { BackButton } from './BackButton';

type ScreenProps = {
  children: ReactNode;
  /** Extra styles merged onto the centered brutalist surface. */
  style?: StyleProp<ViewStyle>;
  /** Render the brutalist top-left back button. */
  showBack?: boolean;
  /** Override the back action (defaults to `router.back()`). */
  onBack?: () => void;
};

/** Full-bleed brutalist surface with content centered. Wraps every screen. */
export function Screen({ children, style, showBack, onBack }: ScreenProps) {
  return (
    <View style={[common.screenCenter, style]}>
      {showBack && <BackButton onPress={onBack} />}
      {children}
    </View>
  );
}
