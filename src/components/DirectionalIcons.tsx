import React from 'react';
import { I18nManager, View } from 'react-native';
import { ArrowLeft as NativeArrowLeft, ChevronLeft as NativeChevronLeft, ChevronRight as NativeChevronRight } from 'lucide-react-native';

function directional(Icon: typeof NativeArrowLeft) {
  return function DirectionalIcon(props: React.ComponentProps<typeof NativeArrowLeft>) {
    return <View accessible={false} pointerEvents="none" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}><Icon {...props} /></View>;
  };
}
export const ArrowLeft = directional(NativeArrowLeft);
export const ChevronLeft = directional(NativeChevronLeft);
export const ChevronRight = directional(NativeChevronRight);
