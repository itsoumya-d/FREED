import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useMotionSettings } from '@/design-system/motion';
import { isCompanionOnScreen } from '@/lib/companion-viewport';

/** Native measurement catches parent scrolling as well as collapsed/hidden sections. */
export function useCompanionViewport(parentVisible = true) {
  const ref = React.useRef<View>(null);
  const viewport = useWindowDimensions();
  const { active } = useMotionSettings(parentVisible);
  const [intersects, setIntersects] = React.useState(true);
  const refresh = React.useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => setIntersects(isCompanionOnScreen({ x, y, width, height }, viewport)));
  }, [viewport.width, viewport.height]);
  React.useEffect(() => {
    if (!active) return;
    let mounted = true;
    const measure = () => ref.current?.measureInWindow((x, y, width, height) => {
      if (mounted) setIntersects(isCompanionOnScreen({ x, y, width, height }, viewport));
    });
    measure();
    const timer = setInterval(measure, 300);
    return () => { mounted = false; clearInterval(timer); };
  }, [active, viewport.width, viewport.height]);
  return { ref, onLayout: refresh, visible: parentVisible && active && intersects };
}
