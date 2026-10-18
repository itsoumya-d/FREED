import React from 'react';
import { MomentumPageHeader, MomentumSection, useMomentumBottomPadding } from '@/components/MomentumPageHeader';
import { ScrollView, useWindowDimensions } from 'react-native';
import { Waves, Activity, Target, Brain, NotebookPen, Dumbbell, BookOpen } from 'lucide-react-native';
import { Text, TextInput, View, Pressable } from '@/components/Localized';
import { Button } from '@/components/ui/Button';
import { getPracticePalette } from '@/design-system/app-palette';
import { useAppTheme } from '@/design-system/use-app-theme';
import { LIBRARY_ARTICLES, type LibraryArticle } from '@/data/library-articles';
import { appI18n, translateSource } from '@/i18n/runtime';
export type LibraryScreenProps = {
  onBack: () => void; onBreathing: () => void; onChallenge: () => void;
  onCustomChallenge: () => void; onCoach: () => void; onJournal: () => void; onMove: () => void;
  onOpenArticle: (article: LibraryArticle) => void; customChallengeCount: number; customChallengesEnabled: boolean;
};
export function LibraryScreen(props: LibraryScreenProps) {
  const bottomPadding = useMomentumBottomPadding();
  const { colors, mode } = useAppTheme(); const { width, fontScale } = useWindowDimensions();
  const [search, setSearch] = React.useState('');
  const articles = LIBRARY_ARTICLES.filter(article => [article.title, article.tag, article.summary].some(value => translateSource(value).toLocaleLowerCase(appI18n.language).includes(search.trim().toLocaleLowerCase(appI18n.language))));
  const narrow = width < 360 || fontScale > 1.35;
  const tools = [
    { category: 'calm' as const, id: 'breathe', title: 'Breathe', detail: 'Calm a craving', Icon: Waves, action: props.onBreathing },
    { category: 'movement' as const, id: 'challenge', title: 'Challenge', detail: 'Guided reset', Icon: Activity, action: props.onChallenge },
    { category: 'commitment' as const, id: 'custom', title: 'Custom', detail: props.customChallengesEnabled ? `${props.customChallengeCount} saved` : 'Premium builder', Icon: Target, action: props.onCustomChallenge },
    { category: 'reflection' as const, id: 'clara', title: 'CLARA', detail: 'Talk it through', Icon: Brain, action: props.onCoach },
    { category: 'reflection' as const, id: 'journal', title: 'Journal', detail: 'Identity notes', Icon: NotebookPen, action: props.onJournal },
    { category: 'movement' as const, id: 'move', title: 'Move', detail: 'Free basic movement', Icon: Dumbbell, action: props.onMove },
  ];
  return <ScrollView testID="library-content" contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingBottom: bottomPadding, gap: 24 }}>
    <MomentumPageHeader pose="read" context="library" title="Recovery Tools" description="When you need a moment" category="reflection" variant="welcome" compact />
    <TextInput testID="library-search" accessibilityLabel="Search recovery articles" placeholder="Search recovery articles" placeholderTextColor={colors.text3} value={search} onChangeText={setSearch} clearButtonMode="while-editing" style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, color: colors.text, fontSize: 17, backgroundColor: colors.surface }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{tools.map(tool => <Pressable key={tool.id} testID={`library-tool-${tool.id}`} accessibilityRole="button" accessibilityLabel={tool.title} onPress={tool.action} style={({ pressed }) => ({ flexBasis: narrow ? '100%' : '46%', flexGrow: 1, minHeight: 104, backgroundColor: getPracticePalette(tool.category, mode).surface, opacity: pressed ? .75 : 1, borderRadius: 16, borderCurve: 'continuous', padding: 16, gap: 8 })}>
      <tool.Icon color={getPracticePalette(tool.category, mode).ink} size={24} /><Text style={{ color: getPracticePalette(tool.category, mode).ink, fontSize: 17, fontWeight: '800' }}>{tool.title}</Text><Text style={{ color: getPracticePalette(tool.category, mode).ink, fontSize: 15, lineHeight: 24 }}>{tool.detail}</Text>
    </Pressable>)}</View>
    <View style={{ gap: 12 }}>{articles.map(article => <Pressable key={article.id} testID={`library-article-${article.id}`} accessibilityRole="button" accessibilityLabel={article.title} onPress={() => props.onOpenArticle(article)} style={({ pressed }) => ({ padding: 24, borderRadius: 16, borderCurve: 'continuous', backgroundColor: pressed ? colors.surface2 : colors.surface, gap: 8 })}>
      <View testID={`library-article-metadata-${article.id}`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <BookOpen size={18} color={colors.mint} />
        <Text selectable style={{ color: colors.text2, fontSize: 13, flexShrink: 1 }}>{article.tag}</Text>
        <Text translate={false} style={{ color: colors.text2 }}>·</Text>
        <Text selectable style={{ color: colors.text2, fontSize: 13, flexShrink: 1 }}>{article.readMinutes} min read</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: '800' }}>{article.title}</Text><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{article.summary}</Text>
    </Pressable>)}</View>
    {articles.length === 0 ? <Text testID="library-empty" accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 15 }}>No articles match your search.</Text> : null}
    <Button label="Back to Today" variant="ghost" onPress={props.onBack} />
  </ScrollView>;
}
