export const isEmptyValue = (value: unknown) =>
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

export const normalizeComparable = (value: unknown) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/[\s-]+/g, '')
        .trim();

export const isDefaultValue = (fieldKey: string, currentValue: unknown, defaultValues: Record<string, any>) =>
    defaultValues[fieldKey] !== undefined &&
    defaultValues[fieldKey] !== null &&
    defaultValues[fieldKey] !== '' &&
    normalizeComparable(currentValue) === normalizeComparable(defaultValues[fieldKey]);

export const shouldApplyApiValue = (params: {
    fieldKey: string;
    nextValue: unknown;
    currentValue: unknown;
    defaultValues?: Record<string, any>;
    previousApiValues?: Record<string, any>;
}) => {
    const {
        fieldKey,
        nextValue,
        currentValue,
        defaultValues = {},
        previousApiValues = {},
    } = params;

    if (isEmptyValue(nextValue)) return false;
    if (isEmptyValue(currentValue)) return true;
    if (isDefaultValue(fieldKey, currentValue, defaultValues)) return true;

    const previousApiValue = previousApiValues[fieldKey];
    if (!isEmptyValue(previousApiValue) && normalizeComparable(currentValue) === normalizeComparable(previousApiValue)) {
        return true;
    }

    return false;
};

export const sanitizeApiSnapshot = (snapshot: Record<string, any>) => {
    const cleaned: Record<string, any> = {};
    Object.entries(snapshot || {}).forEach(([key, value]) => {
        if (!isEmptyValue(value)) {
            cleaned[key] = value;
        }
    });
    return cleaned;
};
