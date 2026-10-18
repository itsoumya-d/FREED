import React from 'react';
import { useNavigationContainerRef, usePathname, useRouter, type Href } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import type { FeatureId } from '@/lib/feature-catalogue';
import { freedProfileSectionPath, parseFreedProfileSection, findFreedNavigatorState, makeFreedRootReset, parseFreedRoute, planFreedNavigation, type FreedNavigationState, type FreedScreen, type FreedTab, type FreedPublicAuxiliaryRoute, type FreedProfileSection } from '@/lib/native-navigation';
type PendingNavigation = { kind: 'screen'; screen: FreedScreen } | { kind: 'feature'; feature: FeatureId; isCurrent: () => boolean } | { kind: 'profile'; section: FreedProfileSection; isCurrent: () => boolean };

/** Owns route coordination only. Recovery and service controllers remain mounted above the navigator. */
export function useFreedNavigation() {
  const router = useRouter();
  const container = useNavigationContainerRef();
  const pathname = usePathname();
  const parsed = parseFreedRoute(pathname);
  // Auxiliary routes own their UI; keep the underlying journey projection and
  // defer its async navigation until the auxiliary route has been dismissed.
  const journeyRoute = React.useRef(parsed);
  const journeyPath = React.useRef(pathname);
  if (!parsed.auxiliaryRoute) { journeyRoute.current = parsed; journeyPath.current = pathname; }
  const [preferredTab, setPreferredTab] = React.useState<FreedTab>(parsed.tab ?? 'today');
  const tab = parsed.tab ?? preferredTab;
  const tabRef = React.useRef(tab);
  const pathRef = React.useRef(pathname);
  const pending = React.useRef<PendingNavigation | null>(null);
  const deferredAuxiliary = React.useRef<FreedPublicAuxiliaryRoute | null>(null);
  const lastDeferredAuxiliary = React.useRef<string | null>(null);
  const resumingAuxiliary = React.useRef(false);
  const [deferredAuxiliaryRoute, setDeferredAuxiliaryRoute] = React.useState<FreedPublicAuxiliaryRoute | null>(null);
  const ready = React.useRef(container.isReady());
  pathRef.current = pathname;
  ready.current = container.isReady();
  if (!parsed.auxiliaryRoute) lastDeferredAuxiliary.current = null;
  if (parsed.tab) tabRef.current = parsed.tab;

  const setScreen = React.useCallback((next: FreedScreen) => {
    // A newer screen intent supersedes its older retry even when delivery is a
    // no-op. Owner-bound feature/profile returns keep their existing handling.
    if (pending.current?.kind === 'screen') pending.current = null;
    if (parseFreedRoute(pathRef.current).auxiliaryRoute || deferredAuxiliary.current) { pending.current = { kind: 'screen', screen: next }; return; }
    if (!container.isReady()) { pending.current = { kind: 'screen', screen: next }; return; }
    const move = planFreedNavigation(pathRef.current, next, tabRef.current);
    const target = move.path as Href;
    if (['intercept', 'ad', 'challenge'].includes(next)) {
      const root = findFreedNavigatorState(container.getRootState() as FreedNavigationState);
      const focused = root?.routes[root.index];
      const destination = focused?.params?.destination;
      const liveRecovery = focused?.name === 'flow/[destination]' && typeof destination === 'string' && ['intercept', 'ad', 'challenge'].includes(destination);
      if (liveRecovery || move.action === 'setParams' || move.action === 'none') {
        if (!liveRecovery || !root?.key || !focused?.key) { pending.current = { kind: 'screen', screen: next }; return; }
        // Pathname can lag rapid callbacks. Read the focused route's live step,
        // retaining this modal's identity and opaque original return parameters.
        if (destination === next) return;
        container.dispatch({ ...CommonActions.setParams({ destination: next }), source: focused.key, target: root.key });
        return;
      }
    }
    if (move.action === 'none') return;
    if (move.action === 'reset') {
      const root = findFreedNavigatorState(container.getRootState() as FreedNavigationState);
      if (!root?.key) { pending.current = { kind: 'screen', screen: next }; return; }
      const nextRoot = makeFreedRootReset(root as FreedNavigationState, next === 'welcome' ? 'welcome' : 'main', tabRef.current);
      container.dispatch({ ...CommonActions.reset(nextRoot as Parameters<typeof CommonActions.reset>[0]), target: root.key });
    } else if (move.action === 'back') {
      router.dismissTo(target);
    } else if (move.action === 'replace') router.replace(target);
    else router.push(target);
  }, [router, container]);
  /** Coordinate only this existing authorized feature return; recheck its caller's ownership at delivery. */
  const replaceFeature = React.useCallback((feature: FeatureId, isCurrent: () => boolean) => {
    if (!isCurrent()) return;
    if (!container.isReady() || parseFreedRoute(pathRef.current).auxiliaryRoute || deferredAuxiliary.current) {
      pending.current = { kind: 'feature', feature, isCurrent }; return;
    }
    router.replace({ pathname: '/flow/feature', params: { feature } });
  }, [router, container]);
  /** An ephemeral private return can only deliver the caller's exact validated page. */
  const returnProfileSection = React.useCallback((section: FreedProfileSection, isCurrent: () => boolean) => {
    if (!parseFreedProfileSection(section) || !isCurrent()) return;
    if (!container.isReady() || parseFreedRoute(pathRef.current).auxiliaryRoute || deferredAuxiliary.current) {
      pending.current = { kind: 'profile', section, isCurrent }; return;
    }
    tabRef.current = 'profile';
    setPreferredTab('profile');
    const root = findFreedNavigatorState(container.getRootState() as FreedNavigationState);
    const profile = root?.routes.find(route => route.name === '(tabs)')?.state?.routes.find(route => route.name === 'profile')?.state;
    const retained = profile?.routes.some(route => route.name === '[section]' && route.params?.section === section);
    const target = freedProfileSectionPath(section) as Href;
    if (retained) router.dismissTo(target);
    else {
      // dismissTo's missing-target fallback replaces; establish index before
      // pushing so a cold return also has a genuine native Back destination.
      router.dismissTo('/profile');
      if (isCurrent()) router.push(target, { withAnchor: true });
    }
  }, [router, container]);
  const applyPending = React.useCallback((request: PendingNavigation) => {
    if (request.kind === 'screen') setScreen(request.screen);
    else if (request.kind === 'feature') replaceFeature(request.feature, request.isCurrent);
    else returnProfileSection(request.section, request.isCurrent);
  }, [setScreen, replaceFeature, returnProfileSection]);
  // An interacted account modal owns credentials and its in-flight operation.
  // Remove an externally requested auxiliary route instead of unmounting that
  // modal. Its exact request resumes after the account fence explicitly closes.
  const deferAuxiliaryPresentation = React.useCallback(() => {
    const auxiliary = parseFreedRoute(pathRef.current).auxiliaryRoute;
    if (!auxiliary) return;
    const root = container.isReady() ? findFreedNavigatorState(container.getRootState() as FreedNavigationState) : null;
    const request = root?.routes[root.index]?.key ?? pathRef.current;
    if (lastDeferredAuxiliary.current === request) return;
    lastDeferredAuxiliary.current = request;
    deferredAuxiliary.current = auxiliary;
    resumingAuxiliary.current = false;
    setDeferredAuxiliaryRoute(auxiliary);
    // Dismiss the entire competing auxiliary chain. Stepping back one route
    // would reinterpret an older stacked auxiliary as a newer user request.
    router.dismissTo((parseFreedRoute(journeyPath.current).auxiliaryRoute ? '/flow/account' : journeyPath.current) as Href);
  }, [router, container]);
  const resumeAuxiliaryPresentation = React.useCallback(() => {
    if (!deferredAuxiliary.current || resumingAuxiliary.current) return;
    resumingAuxiliary.current = true;
    router.push(`/${deferredAuxiliary.current}` as Href);
  }, [router]);
  React.useEffect(() => {
    if (resumingAuxiliary.current && parsed.auxiliaryRoute === deferredAuxiliary.current) {
      resumingAuxiliary.current = false;
      deferredAuxiliary.current = null;
      setDeferredAuxiliaryRoute(null);
    }
  }, [parsed.auxiliaryRoute]);
  /** Read the live app stack; nonterminal Back retains the existing route and its drafts. */
  const backFromTool = React.useCallback(() => {
    const root = container.isReady() ? findFreedNavigatorState(container.getRootState() as FreedNavigationState) : null;
    const previous = root && root.index > 0 ? root.routes[root.index - 1] : null;
    const destination = previous?.name === 'flow/[destination]' ? previous.params?.destination : null;
    if (typeof destination === 'string' && ['intercept', 'ad', 'challenge'].includes(destination)) { setScreen('main'); return; }
    if (previous && router.canGoBack()) router.back();
    else router.replace('/flow/features');
  }, [container, router, setScreen]);
  const setTab = React.useCallback((next: FreedTab) => {
    tabRef.current = next;
    setPreferredTab(next);
    if (!deferredAuxiliary.current && parseFreedRoute(pathRef.current).screen === 'main' && ready.current) router.navigate(`/${next}` as Href);
  }, [router]);
  React.useEffect(() => {
    if (parsed.tab) setPreferredTab(parsed.tab);
    if (ready.current && pending.current) {
      const next = pending.current; pending.current = null; applyPending(next);
    }
  }, [pathname, parsed.tab, applyPending]);
  React.useEffect(() => {
    const flush = () => {
      ready.current = container.isReady();
      if (ready.current && pending.current) { const next = pending.current; pending.current = null; applyPending(next); }
    };
    const readyListener = container.addListener('ready', flush);
    const stateListener = container.addListener('state', flush);
    flush();
    return () => { readyListener(); stateListener(); };
  }, [container, applyPending]);
  return { screen: journeyRoute.current.screen, profileSection: journeyRoute.current.profileSection, auxiliaryRoute: parsed.auxiliaryRoute ?? null, deferredAuxiliaryRoute, deferAuxiliaryPresentation, resumeAuxiliaryPresentation, tab, setScreen, replaceFeature, returnProfileSection, setTab, backFromTool };
}
