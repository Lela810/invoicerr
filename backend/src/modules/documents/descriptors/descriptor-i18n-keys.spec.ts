import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ActionExtensionRegistry } from '../actions/action-extensions';
import { ActionRegistry } from '../actions/action-registry';
import { registerDuplicateExtension } from '../actions/duplicate-extension';
import { defaultComposedCountryCatalog } from '../countries/registry';
import { NO_VAT_CATALOG_HELP_TEXT_KEY } from './company-view';
import { buildNativeDocumentTypeDescriptors } from './native-types';
import { DocumentFieldDescriptor } from './types';

// The frontend translates descriptor text by deriving these keys (frontend/src/lib/descriptor-i18n.ts)
// and falls back to the raw English text when a key is missing, so a missing key never shows up as
// a broken screen: it shows up as English in every other language. This spec is what catches it.
const EN = JSON.parse(
  readFileSync(join(__dirname, '../../../../../frontend/src/locales/en/translation.json'), 'utf-8'),
);

function hasKey(key: string): boolean {
  let node: unknown = EN;
  for (const segment of key.split('.')) {
    if (!node || typeof node !== 'object') return false;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string';
}

function fieldKeys(prefix: string, fields: DocumentFieldDescriptor[], parentPath: string[] = []): string[] {
  return fields.flatMap((field) => {
    const path = [...parentPath, field.key];
    const base = `${prefix}.${path.join('.fields.')}`;
    return [
      `${base}.label`,
      ...(field.helpText ? [`${base}.helpText`] : []),
      ...(field.fields ? fieldKeys(prefix, field.fields, path) : []),
    ];
  });
}

function nativeDescriptorKeys(): string[] {
  const extensions = new ActionExtensionRegistry();
  const actions = new ActionRegistry();
  registerDuplicateExtension('quote', extensions, actions);
  registerDuplicateExtension('invoice', extensions, actions);

  return buildNativeDocumentTypeDescriptors().flatMap((descriptor) => {
    const root = `documents.descriptors.${descriptor.id}`;
    const allActions = [...descriptor.actions, ...extensions.listFor(descriptor.id)];
    return [
      `${root}.label`,
      ...fieldKeys(`${root}.fields`, descriptor.fields),
      ...allActions.flatMap((action) => [
        `${root}.actions.${action.id}.label`,
        ...fieldKeys(`${root}.actions.${action.id}.params`, action.params ?? []),
      ]),
      ...(descriptor.statuses ?? []).map((status) => `${root}.statuses.${status.id}`),
    ];
  });
}

interface CountryFieldText {
  where: string;
  field: DocumentFieldDescriptor;
}

function countryOverlayFields(): CountryFieldText[] {
  const collect = (where: string, field: DocumentFieldDescriptor): CountryFieldText[] => [
    { where, field },
    ...(field.fields ?? []).flatMap((nested) => collect(`${where}.${nested.key}`, nested)),
  ];
  return defaultComposedCountryCatalog.countries().flatMap((countryCode) =>
    (defaultComposedCountryCatalog.get(countryCode)?.countryFields?.overlays ?? []).flatMap((overlay) =>
      overlay.operations.flatMap((operation) => {
        const field = operation.op === 'add' ? operation.field : operation.op === 'modify' ? operation.patch : null;
        if (!field) return [];
        const where = `${countryCode} ${overlay.typeId} ${operation.op} ${operation.path || '(root)'}.${field.key ?? operation.key}`;
        return collect(where, field as DocumentFieldDescriptor);
      }),
    ),
  );
}

describe('descriptor text reaches the translation catalog', () => {
  it('every native type, field, action, param and status label and help text has an English key', () => {
    const missing = nativeDescriptorKeys().filter((key) => !hasKey(key));
    expect(missing).toEqual([]);
  });

  it('every label and help text a country overlay adds names an existing English key', () => {
    const problems = countryOverlayFields().flatMap(({ where, field }) => [
      ...(field.label && !field.labelKey ? [`${where}: label without labelKey`] : []),
      ...(field.labelKey && !hasKey(field.labelKey) ? [`${where}: no English key ${field.labelKey}`] : []),
      ...(field.helpText && !field.helpTextKey ? [`${where}: helpText without helpTextKey`] : []),
      ...(field.helpTextKey && !hasKey(field.helpTextKey)
        ? [`${where}: no English key ${field.helpTextKey}`]
        : []),
    ]);
    expect(problems).toEqual([]);
  });

  it('the help text the VAT rate catalog substitutes at runtime has an English key', () => {
    expect(hasKey(NO_VAT_CATALOG_HELP_TEXT_KEY)).toBe(true);
  });
});
