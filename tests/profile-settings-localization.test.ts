import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { FREED_PROFILE_SECTIONS } from '../src/lib/native-navigation';
const locales=['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'];
function read(language:string){return JSON.parse(readFileSync(`src/i18n/locales/${language}.json`,'utf8'));}
function flatten(input:any,prefix='',result:Record<string,string>={}){for(const [key,value] of Object.entries(input)){const path=prefix?`${prefix}.${key}`:key;if(typeof value==='string')result[path]=value;else flatten(value,path,result);}return result;}
test('all ten Profile Settings semantic catalogs have exactly the same keys and exact private section labels',()=>{
 const english=flatten(read('en').momentum.profileSettings);
 assert.equal(Object.keys(english).length,34);
 for(const locale of locales){const catalog=read(locale).momentum.profileSettings;assert.deepEqual(Object.keys(catalog.sections).sort(),[...FREED_PROFILE_SECTIONS].sort());assert.deepEqual(Object.keys(flatten(catalog)).sort(),Object.keys(english).sort());for(const value of Object.values(flatten(catalog)))assert.ok(value.trim());}
});
test('localized Section labels and explanatory copy do not use private identifiers or grant authority',()=>{
 for(const locale of locales){const catalog=flatten(read(locale).momentum.profileSettings);for(const [key,value] of Object.entries(catalog)){assert.doesNotMatch(value,/@|original-owner|purchase-owner|fixture-id-token/);assert.doesNotMatch(value,/\{\{.*(?:email|uid|owner)/i);if(locale!=='en')assert.notEqual(value,flatten(read('en').momentum.profileSettings)[key]);}}
});
