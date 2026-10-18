import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEATURE_DEFINITIONS, FEATURE_DESTINATIONS, searchFeatures } from '../src/lib/feature-catalogue';
import { parseFreedShieldSection, parseFreedProfileSection } from '../src/lib/native-navigation';
const retired=['activity-estimates','adaptive-signals','achievements','insight','weekly-report','monthly-report','urge-estimate'];
test('public directory hides advanced progress reports while retaining engineering definitions',()=>{
 for(const id of retired){assert.ok(FEATURE_DEFINITIONS.some(f=>f.id===id));assert.ok(!searchFeatures('',s=>s,'en').some(f=>f.id===id));}
 assert.ok(searchFeatures('',s=>s,'en').some(f=>f.id==='history'));
});
test('analytics sharing belongs to account data rather than Progress',()=>{
 assert.equal(FEATURE_DEFINITIONS.find(f=>f.id==='analytics')?.group,'Account/data');
 assert.deepEqual(FEATURE_DESTINATIONS.analytics,{kind:'focus',tab:'profile',section:'analytics-consent'});
});
test('group organizer and analytics consent have focused native routes',()=>{
 assert.equal(parseFreedShieldSection('groups'),'groups');assert.equal(parseFreedProfileSection('analytics-consent'),'analytics-consent');
 assert.equal(parseFreedShieldSection('anything'),null);
});
