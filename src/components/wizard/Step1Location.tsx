"use client";

import React, { useState } from 'react';
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from "use-places-autocomplete";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DiscrepancyLabel } from "@/components/ui/DiscrepancyLabel";
import type { ApiProvider } from '@/types/apiProvider';
import { shouldApplyApiValue, sanitizeApiSnapshot, isEmptyValue } from '@/lib/apiAutofillMerge';

interface Step1Props {
    onDataChange: (data: any) => void;
    initialData?: any;
    onBusyChange?: (busy: boolean) => void;
    selectedApi?: ApiProvider | null;
}

const friendlyLabel = (value: string) => {
    let label = value.replace(/_/g, ' ').trim();
    label = label.replace(/\bPct\b/gi, '%');
    label = label.replace(/\bAvg\b/gi, 'Avg');
    label = label.replace(/\bYr\b/gi, 'Yr');
    label = label.replace(/\bNo\b/gi, 'No.');
    return label.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDetailValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') {
        const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
        if (key.toLowerCase().includes('pct') || key.toLowerCase().includes('percent')) {
            return `${formatted}%`;
        }
        return formatted;
    }
    return String(value);
};

const DemographicsDetails = ({ details }: { details: any }) => {
    if (!details || typeof details !== 'object') return null;
    const sections = [
        { key: 'geography', label: 'Geography' },
        { key: 'demographics', label: 'Demographics' },
        { key: 'crime', label: 'Crime' },
        { key: 'airQuality', label: 'Air Quality' },
        { key: 'climate', label: 'Climate' },
        { key: 'naturalDisasters', label: 'Natural Disasters' },
    ];

    return (
        <div className="space-y-5">
            {sections.map((section) => {
                const data = details?.[section.key];
                if (!data || typeof data !== 'object') return null;
                const entries = Object.entries(data).filter(([, val]) => val !== null && val !== undefined && val !== '');
                if (entries.length === 0) return null;
                return (
                    <div key={section.key} className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-white uppercase tracking-wide">
                            {section.label}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            {entries.map(([key, val]) => (
                                <div
                                    key={`${section.key}-${key}`}
                                    className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 dark:bg-[#1a2434] px-3 py-2"
                                >
                                    <span className="text-slate-600 dark:text-[#92a4c9]">{friendlyLabel(key)}</span>
                                    <span className="text-slate-900 dark:text-white font-medium text-right">
                                        {formatDetailValue(key, val)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const extractCityFromAddressString = (address?: string) => {
    if (!address) return '';
    const parts = address
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);

    if (parts.length >= 3) return parts[1];
    if (parts.length === 2) return parts[0];
    return '';
};

const extractStateFromAddressString = (address?: string) => {
    if (!address) return '';
    const parts = address
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
    if (parts.length < 3) return '';
    const stateZip = parts[2] ?? '';
    return stateZip.split(' ')[0] ?? '';
};

const extractCityFromGeocode = (result: any) => {
    const components = result?.address_components || [];
    const findComponent = (type: string) =>
        components.find((component: any) => component.types?.includes(type))?.long_name ?? '';

    return (
        findComponent('locality') ||
        findComponent('postal_town') ||
        findComponent('administrative_area_level_2') ||
        findComponent('sublocality') ||
        findComponent('neighborhood') ||
        ''
    );
};

const extractCountyFromGeocode = (result: any) => {
    const components = result?.address_components || [];
    return (
        components.find((component: any) => component.types?.includes('administrative_area_level_2'))?.long_name ||
        ''
    );
};

const extractZipFromGeocode = (result: any) => {
    const components = result?.address_components || [];
    return (
        components.find((component: any) => component.types?.includes('postal_code'))?.long_name ||
        ''
    );
};

const extractStateFromGeocode = (result: any) => {
    const components = result?.address_components || [];
    return (
        components.find((component: any) => component.types?.includes('administrative_area_level_1'))?.short_name ||
        ''
    );
};

const GooglePlacesInput = ({ onDataChange, initialData, onBusyChange, selectedApi }: Step1Props) => {
    const {
        ready,
        value,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        debounce: 300,
        defaultValue: initialData?.address || "",
    });

    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(initialData?.lat ? { lat: initialData.lat, lng: initialData.lng } : null);
    const [projectName, setProjectName] = useState(initialData?.name ?? '');
    const [attomLoading, setAttomLoading] = useState(false);
    const [attomError, setAttomError] = useState<string | null>(null);
    const [attomMessage, setAttomMessage] = useState<string | null>(null);
    const [showMoreDemographics, setShowMoreDemographics] = useState(false);
    const lastGeocodedAddressRef = React.useRef<string>('');
    const geocodeRequestSeqRef = React.useRef(0);
    const censusFipsCacheRef = React.useRef<Map<string, string | null>>(new Map());
    const dataUsaCacheRef = React.useRef<Map<string, Record<string, number | null> | null>>(new Map());
    const pdfValues = initialData?.pdf_values || {};
    const apiValues = initialData?.api_values || {};
    const defaultValues = initialData?.default_values || {};
    const isEmptyValue = (value: any) =>
        value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    const normalizeComparable = (value: any) =>
        String(value ?? '')
            .toLowerCase()
            .replace(/[\s-]+/g, '')
            .trim();
    const isDefaultValue = (key: string, currentValue: any) =>
        defaultValues[key] !== undefined &&
        defaultValues[key] !== null &&
        defaultValues[key] !== '' &&
        normalizeComparable(currentValue) === normalizeComparable(defaultValues[key]);
    const normalizeParcelIdentifier = (value: unknown) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        return raw.replace(/[\s-]+/g, '');
    };
    const isEmptyOrDefault = (key: string, currentValue: any) =>
        isEmptyValue(currentValue) || isDefaultValue(key, currentValue);
    React.useEffect(() => {
        if (typeof initialData?.mobile_home_park_name === 'string') {
            setProjectName(initialData.mobile_home_park_name);
        } else if (typeof initialData?.name === 'string') {
            setProjectName(initialData.name);
        }
        if (typeof initialData?.address === 'string') {
            setValue(initialData.address, false);
        } else if (typeof initialData?.mobile_home_park_address === 'string') {
            setValue(initialData.mobile_home_park_address, false);
        }
        if (initialData?.lat && initialData?.lng) {
            setCoordinates({ lat: initialData.lat, lng: initialData.lng });
        }
    }, [initialData?.mobile_home_park_name, initialData?.name, initialData?.mobile_home_park_address, initialData?.address, initialData?.lat, initialData?.lng, setValue]);

    React.useEffect(() => {
        onBusyChange?.(attomLoading);
    }, [attomLoading, onBusyChange]);

    const resolveFipsFromCensusByCoords = React.useCallback(async (lat: number, lng: number) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const cacheKey = `${lat.toFixed(6)}|${lng.toFixed(6)}`;
        if (censusFipsCacheRef.current.has(cacheKey)) {
            return censusFipsCacheRef.current.get(cacheKey) ?? null;
        }

        try {
            const response = await fetch('/api/census/fips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat,
                    lng,
                }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    censusFipsCacheRef.current.set(cacheKey, null);
                }
                return null;
            }

            const payload = await response.json();
            const fipsCode = typeof payload?.fips_code === 'string' ? payload.fips_code.trim() : '';
            const resolved = fipsCode || null;
            censusFipsCacheRef.current.set(cacheKey, resolved);
            return resolved;
        } catch (error) {
            console.warn('Census FIPS lookup failed:', error);
            return null;
        }
    }, []);

    const resolveDemographicsFromDataUsa = React.useCallback(async (fipsCode: string) => {
        const normalizedFips = String(fipsCode || '').replace(/\D/g, '').padStart(5, '0').slice(-5);
        if (!normalizedFips) return null;

        if (dataUsaCacheRef.current.has(normalizedFips)) {
            return dataUsaCacheRef.current.get(normalizedFips) ?? null;
        }

        try {
            const response = await fetch('/api/datausa/county', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fips_code: normalizedFips }),
            });
            if (!response.ok) {
                if (response.status === 404) {
                    dataUsaCacheRef.current.set(normalizedFips, null);
                }
                return null;
            }

            const payload = await response.json();
            const result: Record<string, number | null> = {};
            if (typeof payload?.population === 'number') {
                result.population = payload.population;
            }
            if (typeof payload?.population_change === 'number') {
                result.population_change = payload.population_change;
            }
            if (typeof payload?.median_household_income === 'number') {
                result.median_household_income = payload.median_household_income;
            }
            if (typeof payload?.median_household_income_change === 'number') {
                result.median_household_income_change = payload.median_household_income_change;
            }
            if (typeof payload?.median_property_value === 'number') {
                result.median_property_value = payload.median_property_value;
            }
            if (typeof payload?.median_property_value_change === 'number') {
                result.median_property_value_change = payload.median_property_value_change;
            }
            if (typeof payload?.poverty_rate === 'number') {
                result.poverty_rate = payload.poverty_rate;
            }
            if (typeof payload?.number_of_employees === 'number') {
                result.number_of_employees = payload.number_of_employees;
            }
            if (typeof payload?.number_of_employees_change === 'number') {
                result.number_of_employees_change = payload.number_of_employees_change;
            }
            if (typeof payload?.number_of_businesses === 'number') {
                result.number_of_businesses = payload.number_of_businesses;
            }
            if (typeof payload?.two_br_rent === 'number') {
                result.two_br_rent = payload.two_br_rent;
            }
            if (typeof payload?.eli_renter_households === 'number') {
                result.eli_renter_households = payload.eli_renter_households;
            }
            if (typeof payload?.units_per_100 === 'number') {
                result.units_per_100 = payload.units_per_100;
            }
            if (typeof payload?.total_units === 'number') {
                result.total_units = payload.total_units;
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'violent_crime')) {
                result.violent_crime = typeof payload?.violent_crime === 'number' ? payload.violent_crime : null;
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'property_crime')) {
                result.property_crime = typeof payload?.property_crime === 'number' ? payload.property_crime : null;
            }
            const resolved = Object.keys(result).length > 0 ? result : null;
            dataUsaCacheRef.current.set(normalizedFips, resolved);
            return resolved;
        } catch (error) {
            console.warn('DataUSA demographics lookup failed:', error);
            return null;
        }
    }, []);

    const attachDataUsaDemographics = React.useCallback(async (
        fipsCode: string,
        targetPayload: Record<string, any>,
        targetApiValues: Record<string, any>
    ) => {
        const demographics = await resolveDemographicsFromDataUsa(fipsCode);
        if (!demographics) return;

        const assignIfAllowed = (fieldKey: string, nextValue: any) => {
            if (!shouldApplyApiValue({
                fieldKey,
                nextValue,
                currentValue: initialData?.[fieldKey],
                defaultValues,
                previousApiValues: apiValues,
            })) {
                return;
            }
            targetPayload[fieldKey] = nextValue;
            targetApiValues[fieldKey] = nextValue;
        };

        assignIfAllowed('population', demographics.population);
        assignIfAllowed('population_change', demographics.population_change);
        assignIfAllowed('median_household_income', demographics.median_household_income);
        assignIfAllowed('median_household_income_change', demographics.median_household_income_change);
        assignIfAllowed('median_property_value', demographics.median_property_value);
        assignIfAllowed('median_property_value_change', demographics.median_property_value_change);
        assignIfAllowed('poverty_rate', demographics.poverty_rate);
        assignIfAllowed('number_of_employees', demographics.number_of_employees);
        assignIfAllowed('number_of_employees_change', demographics.number_of_employees_change);
        if (demographics.number_of_businesses !== undefined) {
            targetApiValues.number_of_businesses = demographics.number_of_businesses;
        }
        assignIfAllowed('two_br_rent', demographics.two_br_rent);
        assignIfAllowed('eli_renter_households', demographics.eli_renter_households);
        assignIfAllowed('units_per_100', demographics.units_per_100);
        assignIfAllowed('total_units', demographics.total_units);
        if (Object.prototype.hasOwnProperty.call(demographics, 'violent_crime')) {
            assignIfAllowed('violent_crime', demographics.violent_crime ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(demographics, 'property_crime')) {
            assignIfAllowed('property_crime', demographics.property_crime ?? null);
        }
    }, [apiValues, defaultValues, initialData, resolveDemographicsFromDataUsa]);

    React.useEffect(() => {
        const address = initialData?.address;
        if (!address || !ready) return;
        if (initialData?.lat && initialData?.lng) return;
        if (lastGeocodedAddressRef.current === address) return;

        lastGeocodedAddressRef.current = address;
        let isActive = true;
        const requestSeq = ++geocodeRequestSeqRef.current;

        getGeocode({ address })
            .then(async (results) => {
                if (!isActive || !results?.[0]) return;
                const { lat, lng } = await getLatLng(results[0]);
                if (!isActive || requestSeq !== geocodeRequestSeqRef.current) return;
                setCoordinates({ lat, lng });

                const updates: Record<string, any> = {};
                if (!initialData?.lat && !initialData?.lng) {
                    updates.lat = lat;
                    updates.lng = lng;
                }

                const city = extractCityFromGeocode(results[0]);
                const county = extractCountyFromGeocode(results[0]);
                const state = extractStateFromGeocode(results[0]);
                const zipCode = extractZipFromGeocode(results[0]);

                if (city) updates.city = city;
                if (county) updates.county = county;
                if (state) updates.state = state;
                if (zipCode) updates.zip_code = zipCode;
                const fipsCode = await resolveFipsFromCensusByCoords(lat, lng);
                if (!isActive || requestSeq !== geocodeRequestSeqRef.current) return;
                if (fipsCode) {
                    updates.fips_code = fipsCode;
                    updates.api_values = { ...(initialData?.api_values || {}), fips_code: fipsCode };
                }
                if (address) updates.mobile_home_park_address = address;

                if (Object.keys(updates).length > 0) {
                    onDataChange(updates);
                }
            })
            .catch((error) => {
                console.error('Geocode failed:', error);
            });

        return () => {
            isActive = false;
        };
    }, [initialData?.address, initialData?.lat, initialData?.lng, initialData?.city, initialData?.county, initialData?.api_values, onDataChange, ready, resolveFipsFromCensusByCoords]);

    const shouldFillWithAttom = (currentValue: any, key: string) => {
        if (isEmptyOrDefault(key, currentValue)) return true;
        const previousApiValue = apiValues?.[key];
        if (!isEmptyValue(previousApiValue) && normalizeComparable(currentValue) === normalizeComparable(previousApiValue)) {
            return true;
        }
        return false;
    };

    const applyAttomData = (payload: any) => {
        const identity = payload?.property_identity;
        if (!identity) return;

        const financials = payload?.financials || {};
        const demographics = payload?.demographics_economics || {};
        const housing = payload?.housing_crisis_metrics || {};
        const demographicsDetails = payload?.demographics_details || null;

        const updates: Record<string, any> = {};
        const attomSnapshot: Record<string, any> = {};
        const normalizedApn = normalizeParcelIdentifier(identity.apn);
        if (identity.owner) attomSnapshot.owner_name = identity.owner;
        if (normalizedApn) attomSnapshot.parcelNumber = normalizedApn;
        if (normalizedApn) attomSnapshot.parcel_1 = normalizedApn;
        if (identity.fips_code) attomSnapshot.fips_code = identity.fips_code;
        if (identity.acreage) attomSnapshot.acreage = identity.acreage;
        if (identity.acreage) attomSnapshot.parcel_1_acreage = identity.acreage;
        if (identity.year_built) attomSnapshot.year_built = identity.year_built;
        if (identity.property_type) attomSnapshot.property_type = identity.property_type;
        if (financials.last_sale_price) attomSnapshot.last_sale_price = financials.last_sale_price;

        if (identity.owner && shouldFillWithAttom(initialData?.owner_name, 'owner_name')) {
            updates.owner_name = identity.owner;
        }
        if (normalizedApn && shouldFillWithAttom(initialData?.parcelNumber, 'parcelNumber')) {
            updates.parcelNumber = normalizedApn;
        }
        if (normalizedApn && shouldFillWithAttom(initialData?.parcel_1, 'parcel_1')) {
            updates.parcel_1 = normalizedApn;
        }
        if (identity.fips_code && isEmptyOrDefault('fips_code', initialData?.fips_code)) {
            updates.fips_code = identity.fips_code;
        }
        if (identity.acreage && shouldFillWithAttom(initialData?.acreage, 'acreage')) {
            updates.acreage = identity.acreage;
        }
        if (identity.acreage && shouldFillWithAttom(initialData?.parcel_1_acreage, 'parcel_1_acreage')) {
            updates.parcel_1_acreage = identity.acreage;
        }
        if (identity.year_built && shouldFillWithAttom(initialData?.year_built, 'year_built')) {
            updates.year_built = identity.year_built;
        }
        if (identity.property_type && shouldFillWithAttom(initialData?.property_type, 'property_type')) {
            updates.property_type = identity.property_type;
        }
        if (financials.last_sale_price && shouldFillWithAttom(initialData?.last_sale_price, 'last_sale_price')) {
            updates.last_sale_price = financials.last_sale_price;
        }
        if (!initialData?.mobile_home_park_name && initialData?.name) updates.mobile_home_park_name = initialData.name;

        if (shouldFillWithAttom(initialData?.population, 'population') && demographics.population) updates.population = demographics.population;
        if (shouldFillWithAttom(initialData?.population_change, 'population_change') && demographics.population_change) {
            updates.population_change = demographics.population_change;
        }
        if (shouldFillWithAttom(initialData?.median_household_income, 'median_household_income') && demographics.median_household_income) {
            updates.median_household_income = demographics.median_household_income;
        }
        if (shouldFillWithAttom(initialData?.median_household_income_change, 'median_household_income_change') && demographics.median_household_income_change) {
            updates.median_household_income_change = demographics.median_household_income_change;
        }
        if (shouldFillWithAttom(initialData?.poverty_rate, 'poverty_rate') && demographics.poverty_rate) updates.poverty_rate = demographics.poverty_rate;
        if (shouldFillWithAttom(initialData?.number_of_employees, 'number_of_employees') && demographics.number_of_employees) {
            updates.number_of_employees = demographics.number_of_employees;
        }
        if (shouldFillWithAttom(initialData?.number_of_employees_change, 'number_of_employees_change') && demographics.number_of_employees_change) {
            updates.number_of_employees_change = demographics.number_of_employees_change;
        }
        if (shouldFillWithAttom(initialData?.median_property_value, 'median_property_value') && demographics.median_property_value) {
            updates.median_property_value = demographics.median_property_value;
        }
        if (shouldFillWithAttom(initialData?.median_property_value_change, 'median_property_value_change') && demographics.median_property_value_change) {
            updates.median_property_value_change = demographics.median_property_value_change;
        }
        const crimeDetails = demographicsDetails?.crime || {};
        const violentCrimeValue = crimeDetails?.crime_Index ?? initialData?.crime_Index ?? demographics.violent_crime ?? null;
        const propertyCrimeValue =
            crimeDetails?.motor_Vehicle_Theft_Index ?? initialData?.motor_Vehicle_Theft_Index ?? demographics.property_crime ?? null;
        if (violentCrimeValue !== null && violentCrimeValue !== undefined && shouldFillWithAttom(initialData?.violent_crime, 'violent_crime')) {
            updates.violent_crime = violentCrimeValue;
        }
        if (propertyCrimeValue !== null && propertyCrimeValue !== undefined && shouldFillWithAttom(initialData?.property_crime, 'property_crime')) {
            updates.property_crime = propertyCrimeValue;
        }
        if (shouldFillWithAttom(initialData?.two_br_rent, 'two_br_rent') && demographics.two_br_rent) {
            updates.two_br_rent = demographics.two_br_rent;
        }
        if (shouldFillWithAttom(initialData?.eli_renter_households, 'eli_renter_households') && housing.eli_renter_households) {
            updates.eli_renter_households = housing.eli_renter_households;
        }
        if (shouldFillWithAttom(initialData?.units_per_100, 'units_per_100') && housing.affordable_units_per_100) {
            updates.units_per_100 = housing.affordable_units_per_100;
        }
        if (shouldFillWithAttom(initialData?.total_units, 'total_units') && housing.total_units) updates.total_units = housing.total_units;
        if (demographicsDetails && shouldFillWithAttom(initialData?.demographics_details, 'demographics_details')) {
            updates.demographics_details = demographicsDetails;
        }

        const providerSnapshot = sanitizeApiSnapshot(payload?.api_snapshot || {});
        const mergedApiValues = { ...(initialData?.api_values || {}), ...attomSnapshot, ...providerSnapshot };
        if (Object.keys(mergedApiValues).length > 0) {
            updates.api_values = mergedApiValues;
        }

        if (Object.keys(updates).length > 0) {
            onDataChange(updates);
        }
    };

    const applyPdfFallback = () => {
        if (!pdfValues) return;
        const updates: Record<string, any> = {};
        const pdfParcel = normalizeParcelIdentifier(pdfValues.parcel_1 || pdfValues.parcelNumber);
        if (isEmptyOrDefault('parcel_1', initialData?.parcel_1) && pdfParcel) updates.parcel_1 = pdfParcel;
        if (isEmptyOrDefault('parcelNumber', initialData?.parcelNumber) && pdfParcel) updates.parcelNumber = pdfParcel;
        if (isEmptyOrDefault('parcel_1_acreage', initialData?.parcel_1_acreage) && pdfValues.parcel_1_acreage) {
            updates.parcel_1_acreage = pdfValues.parcel_1_acreage;
        }
        if (isEmptyOrDefault('acreage', initialData?.acreage) && pdfValues.acreage) updates.acreage = pdfValues.acreage;
        if (isEmptyOrDefault('property_type', initialData?.property_type) && pdfValues.property_type) updates.property_type = pdfValues.property_type;
        if (isEmptyOrDefault('year_built', initialData?.year_built) && pdfValues.year_built) updates.year_built = pdfValues.year_built;
        if (isEmptyOrDefault('last_sale_price', initialData?.last_sale_price) && pdfValues.last_sale_price) {
            updates.last_sale_price = pdfValues.last_sale_price;
        }
        if (isEmptyOrDefault('owner_name', initialData?.owner_name) && pdfValues.owner_name) {
            updates.owner_name = pdfValues.owner_name;
        }
        if (Object.keys(updates).length > 0) {
            onDataChange(updates);
        }
    };

    React.useEffect(() => {
        applyPdfFallback();
    }, [
        initialData?.parcel_1,
        initialData?.parcelNumber,
        initialData?.parcel_1_acreage,
        initialData?.acreage,
        initialData?.property_type,
        initialData?.year_built,
        initialData?.last_sale_price,
        initialData?.owner_name,
        pdfValues?.parcel_1,
        pdfValues?.parcelNumber,
        pdfValues?.parcel_1_acreage,
        pdfValues?.acreage,
        pdfValues?.property_type,
        pdfValues?.year_built,
        pdfValues?.last_sale_price,
        pdfValues?.owner_name,
    ]);

    const fetchAttomData = async (addressToUse: string, coords?: { lat: number; lng: number }) => {
        if (!selectedApi) {
            setAttomError('Select an API source first.');
            return;
        }
        const existingApn = normalizeParcelIdentifier(
            initialData?.parcel_1 || initialData?.parcelNumber || pdfValues?.parcel_1 || pdfValues?.parcelNumber
        );
        if (!addressToUse && !coords && !existingApn) return;
        setAttomLoading(true);
        setAttomError(null);
        setAttomMessage(null);
        try {
            const response = await fetch('/api/property/autofill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedApi,
                    intent: 'step1',
                    address: addressToUse || undefined,
                    lat: coords?.lat,
                    lng: coords?.lng,
                    apn: existingApn || undefined,
                    fips_code: initialData?.fips_code,
                    county: initialData?.county,
                    city: initialData?.city,
                    state: initialData?.state,
                    zip_code: initialData?.zip_code,
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || 'Auto-fill request failed');
            }
            if (!payload?.apn_found) {
                setAttomMessage(payload?.message || `No APN/Assessor ID found via address or coordinates for ${selectedApi}.`);
                applyPdfFallback();
                return;
            }
            applyAttomData(payload);
            setAttomMessage(payload?.message || 'AI: data found.');
        } catch (error: any) {
            console.warn('Autofill failed:', error?.message || error);
            setAttomError(error.message || 'Auto-fill request failed');
            applyPdfFallback();
        } finally {
            setAttomLoading(false);
        }
    };

    const geocodeAddress = async (addressToUse: string, options?: { includeDataUsa?: boolean }) => {
        const includeDataUsa = Boolean(options?.includeDataUsa);
        const requestSeq = ++geocodeRequestSeqRef.current;
        const results = await getGeocode({ address: addressToUse });
        if (!results?.[0] || requestSeq !== geocodeRequestSeqRef.current) return null;
        const { lat, lng } = await getLatLng(results[0]);
        if (requestSeq !== geocodeRequestSeqRef.current) return null;
        setCoordinates({ lat, lng });
        const city = extractCityFromGeocode(results[0]);
        const county = extractCountyFromGeocode(results[0]);
        const state = extractStateFromGeocode(results[0]);
        const zipCode = extractZipFromGeocode(results[0]);

        const payload: Record<string, any> = {
            address: addressToUse,
            mobile_home_park_address: addressToUse,
            city,
            state,
            zip_code: zipCode,
            lat,
            lng,
        };
        if (county) {
            payload.county = county;
        }
        const fipsCode = await resolveFipsFromCensusByCoords(lat, lng);
        if (requestSeq !== geocodeRequestSeqRef.current) return null;
        if (fipsCode) {
            payload.fips_code = fipsCode;
            const apiValuesUpdate: Record<string, any> = { ...(initialData?.api_values || {}), fips_code: fipsCode };
            if (includeDataUsa) {
                await attachDataUsaDemographics(fipsCode, payload, apiValuesUpdate);
                if (requestSeq !== geocodeRequestSeqRef.current) return null;
            }
            payload.api_values = apiValuesUpdate;
        }
        onDataChange(payload);
        return { lat, lng };
    };

    const handleSelect = async (address: string) => {
        setValue(address, false);
        clearSuggestions();

        try {
            await geocodeAddress(address);
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const handleAddressSync = async () => {
        if (!value) return;
        try {
            await geocodeAddress(value);
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const handleAutoFillClick = async () => {
        const existingApn = normalizeParcelIdentifier(
            initialData?.parcel_1 || initialData?.parcelNumber || pdfValues?.parcel_1 || pdfValues?.parcelNumber
        );
        if (!value && !existingApn) return;
        try {
            const coords = value ? await geocodeAddress(value, { includeDataUsa: true }) : undefined;
            await fetchAttomData(value, coords || undefined);
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Location & Details</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">Enter project name and search for the RV park location.</p>
            </div>

            <div>
                <DiscrepancyLabel
                    label="Mobile Home Park Name"
                    fieldKey="mobile_home_park_name"
                    currentValue={projectName}
                    pdfValues={pdfValues}
                        apiValues={apiValues}
                />
                <Input
                    value={projectName}
                    onChange={(e) => {
                        const nextValue = e.target.value;
                        setProjectName(nextValue);
                        onDataChange({
                            name: nextValue,
                            mobile_home_park_name: nextValue
                        });
                    }}
                    placeholder="e.g., Sunset RV Park"
                    className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white focus:ring-blue-500"
                />
            </div>

            <div>
                <DiscrepancyLabel
                    label="Owner Name"
                    fieldKey="owner_name"
                    currentValue={initialData?.owner_name ?? ''}
                    pdfValues={pdfValues}
                        apiValues={apiValues}
                />
                <Input
                    value={initialData?.owner_name ?? ''}
                    onChange={(e) => onDataChange({ owner_name: e.target.value })}
                    placeholder="Auto-filled from PDF or API"
                    className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <DiscrepancyLabel
                        label="Mobile Home Park Address"
                        fieldKey="mobile_home_park_address"
                        currentValue={value}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                        className="mb-0"
                    />
                    <Button
                        onClick={handleAutoFillClick}
                        disabled={attomLoading || (!value && !(initialData?.parcel_1 || initialData?.parcelNumber || pdfValues?.parcel_1 || pdfValues?.parcelNumber))}
                        variant="outline"
                        className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                    >
                        {attomLoading ? "Fetching..." : "AI Auto-Fill"}
                    </Button>
                </div>
                <div className="relative">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={handleAddressSync}
                        disabled={!ready}
                        placeholder="Search address..."
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white focus:ring-blue-500"
                    />
                    {status === "OK" && (
                        <ul className="absolute z-10 w-full bg-white dark:bg-[#1a2228] border border-slate-200 dark:border-[#283339] rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                            {data.map(({ place_id, description }) => (
                                <li
                                    key={place_id}
                                    onClick={() => handleSelect(description)}
                                    className="cursor-pointer px-4 py-2 hover:bg-slate-100 dark:hover:bg-[#283339] text-slate-900 dark:text-white text-sm"
                                >
                                    {description}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {attomError && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {attomError}
                </div>
            )}
            {attomMessage && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/40 rounded-lg text-blue-600 dark:text-blue-300 text-sm">
                    {attomMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <DiscrepancyLabel
                        label="City"
                        fieldKey="city"
                        currentValue={initialData?.city ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.city ?? ''}
                        onChange={(e) => onDataChange({ city: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="State"
                        fieldKey="state"
                        currentValue={initialData?.state ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.state ?? ''}
                        onChange={(e) => onDataChange({ state: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="County"
                        fieldKey="county"
                        currentValue={initialData?.county ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.county ?? ''}
                        onChange={(e) => onDataChange({ county: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Zip Code"
                        fieldKey="zip_code"
                        currentValue={initialData?.zip_code ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.zip_code ?? ''}
                        onChange={(e) => onDataChange({ zip_code: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="FIPS Code"
                        fieldKey="fips_code"
                        currentValue={initialData?.fips_code ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.fips_code ?? ''}
                        onChange={(e) => onDataChange({ fips_code: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Parcel Number"
                        fieldKey="parcel_1"
                        currentValue={(initialData?.parcel_1 ?? '') || (initialData?.parcelNumber ?? '')}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={(initialData?.parcel_1 ?? '') || (initialData?.parcelNumber ?? '')}
                        onChange={(e) => {
                            const normalized = e.target.value.replace(/[\s-]+/g, '').trim();
                            onDataChange({ parcel_1: normalized, parcelNumber: normalized });
                        }}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Acreage (Acres)"
                        fieldKey="parcel_1_acreage"
                        currentValue={(initialData?.parcel_1_acreage ?? '') || (initialData?.acreage ?? '')}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        type="number"
                        value={(initialData?.parcel_1_acreage ?? '') || (initialData?.acreage ?? '')}
                        onChange={(e) => onDataChange({ parcel_1_acreage: e.target.value, acreage: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Year Built"
                        fieldKey="year_built"
                        currentValue={initialData?.year_built ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        type="number"
                        value={initialData?.year_built ?? ''}
                        onChange={(e) => onDataChange({ year_built: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Property Type"
                        fieldKey="property_type"
                        currentValue={initialData?.property_type ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.property_type ?? ''}
                        onChange={(e) => onDataChange({ property_type: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Last Sale Price"
                        fieldKey="last_sale_price"
                        currentValue={initialData?.last_sale_price ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={initialData?.last_sale_price ?? ''}
                            onChange={(e) => onDataChange({ last_sale_price: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white pl-8"
                        />
                    </div>
                </div>
            </div>

            {/* Map Preview */}
            <div className="rounded-xl overflow-hidden h-64 bg-slate-100 dark:bg-[#0e1214] border border-slate-200 dark:border-[#283339] relative flex items-center justify-center">
                {coordinates ? (
                    <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.lat},${coordinates.lng}&zoom=17&size=600x300&maptype=satellite&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`}
                        alt="Satellite View"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-slate-500 dark:text-gray-500 text-sm">Enter address to see map</div>
                )}
            </div>
            {coordinates && (
                <div className="text-xs text-slate-500 dark:text-gray-400">
                    Lat: {coordinates.lat.toFixed(6)} • Lng: {coordinates.lng.toFixed(6)}
                </div>
            )}

            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Demographics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <DiscrepancyLabel
                            label="Population"
                            fieldKey="population"
                            currentValue={initialData?.population ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.population ?? ''}
                            onChange={(e) => onDataChange({ population: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Population % Change"
                            fieldKey="population_change"
                            currentValue={initialData?.population_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.population_change ?? ''}
                                onChange={(e) => onDataChange({ population_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Poverty Rate"
                            fieldKey="poverty_rate"
                            currentValue={initialData?.poverty_rate ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.poverty_rate ?? ''}
                                onChange={(e) => onDataChange({ poverty_rate: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income"
                            fieldKey="median_household_income"
                            currentValue={initialData?.median_household_income ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_household_income ?? ''}
                                onChange={(e) => onDataChange({ median_household_income: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income % Change"
                            fieldKey="median_household_income_change"
                            currentValue={initialData?.median_household_income_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_household_income_change ?? ''}
                                onChange={(e) => onDataChange({ median_household_income_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Number of Employees"
                            fieldKey="number_of_employees"
                            currentValue={initialData?.number_of_employees ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.number_of_employees ?? ''}
                            onChange={(e) => onDataChange({ number_of_employees: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Number of Employees % Change"
                            fieldKey="number_of_employees_change"
                            currentValue={initialData?.number_of_employees_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.number_of_employees_change ?? ''}
                                onChange={(e) => onDataChange({ number_of_employees_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value"
                            fieldKey="median_property_value"
                            currentValue={initialData?.median_property_value ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_property_value ?? ''}
                                onChange={(e) => onDataChange({ median_property_value: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value % Change"
                            fieldKey="median_property_value_change"
                            currentValue={initialData?.median_property_value_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_property_value_change ?? ''}
                                onChange={(e) => onDataChange({ median_property_value_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Violent Crime"
                            fieldKey="violent_crime"
                            currentValue={initialData?.violent_crime ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.violent_crime ?? ''}
                            onChange={(e) => onDataChange({ violent_crime: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Property Crime"
                            fieldKey="property_crime"
                            currentValue={initialData?.property_crime ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.property_crime ?? ''}
                            onChange={(e) => onDataChange({ property_crime: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="2 BR Rent"
                            fieldKey="two_br_rent"
                            currentValue={initialData?.two_br_rent ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.two_br_rent ?? ''}
                                onChange={(e) => onDataChange({ two_br_rent: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="ELI Renter Households"
                            fieldKey="eli_renter_households"
                            currentValue={initialData?.eli_renter_households ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.eli_renter_households ?? ''}
                            onChange={(e) => onDataChange({ eli_renter_households: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Units per 100"
                            fieldKey="units_per_100"
                            currentValue={initialData?.units_per_100 ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.units_per_100 ?? ''}
                            onChange={(e) => onDataChange({ units_per_100: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Total Units"
                            fieldKey="total_units"
                            currentValue={initialData?.total_units ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.total_units ?? ''}
                            onChange={(e) => onDataChange({ total_units: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                </div>
            </div>
            {initialData?.demographics_details && (
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => setShowMoreDemographics((prev) => !prev)}
                        className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300"
                    >
                        <span className={`material-symbols-outlined transition-transform ${showMoreDemographics ? 'rotate-180' : ''}`}>
                            expand_more
                        </span>
                        More demographics
                    </button>
                    {showMoreDemographics && (
                        <div className="mt-4">
                            <DemographicsDetails details={initialData.demographics_details} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const Step1Location: React.FC<Step1Props> = ({ onDataChange, initialData, onBusyChange, selectedApi }) => {
    const hasApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY.includes('placeholder');
    const [manualName, setManualName] = React.useState(initialData?.name ?? '');
    const [manualAddress, setManualAddress] = React.useState(initialData?.address ?? '');
    const [attomLoading, setAttomLoading] = React.useState(false);
    const [attomError, setAttomError] = React.useState<string | null>(null);
    const [attomMessage, setAttomMessage] = React.useState<string | null>(null);
    const [showMoreDemographics, setShowMoreDemographics] = React.useState(false);
    const pdfValues = initialData?.pdf_values || {};
    const apiValues = initialData?.api_values || {};
    const defaultValues = initialData?.default_values || {};
    const isEmptyValue = (value: any) =>
        value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    const normalizeComparable = (value: any) =>
        String(value ?? '')
            .toLowerCase()
            .replace(/[\s-]+/g, '')
            .trim();
    const isDefaultValue = (key: string, currentValue: any) =>
        defaultValues[key] !== undefined &&
        defaultValues[key] !== null &&
        defaultValues[key] !== '' &&
        normalizeComparable(currentValue) === normalizeComparable(defaultValues[key]);
    const normalizeParcelIdentifier = (value: unknown) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        return raw.replace(/[\s-]+/g, '');
    };
    const isEmptyOrDefault = (key: string, currentValue: any) =>
        isEmptyValue(currentValue) || isDefaultValue(key, currentValue);
    const shouldFillWithAttom = (currentValue: any, key: string) => {
        if (isEmptyOrDefault(key, currentValue)) return true;
        const previousApiValue = apiValues?.[key];
        if (!isEmptyValue(previousApiValue) && normalizeComparable(currentValue) === normalizeComparable(previousApiValue)) {
            return true;
        }
        return false;
    };

    React.useEffect(() => {
        if (typeof initialData?.mobile_home_park_name === 'string') {
            setManualName(initialData.mobile_home_park_name);
        } else if (typeof initialData?.name === 'string') {
            setManualName(initialData.name);
        }
        if (typeof initialData?.mobile_home_park_address === 'string') {
            setManualAddress(initialData.mobile_home_park_address);
        } else if (typeof initialData?.address === 'string') {
            setManualAddress(initialData.address);
        }
    }, [initialData?.mobile_home_park_name, initialData?.name, initialData?.mobile_home_park_address, initialData?.address]);

    React.useEffect(() => {
        onBusyChange?.(attomLoading);
    }, [attomLoading, onBusyChange]);

    const fetchAttomData = async () => {
        const existingApn = normalizeParcelIdentifier(
            initialData?.parcel_1 || initialData?.parcelNumber || pdfValues?.parcel_1 || pdfValues?.parcelNumber
        );
        if (!manualAddress && !initialData?.lat && !existingApn) return;
        if (!selectedApi) {
            setAttomError('Select an API source first.');
            return;
        }
        setAttomLoading(true);
        setAttomError(null);
        setAttomMessage(null);
        try {
            const response = await fetch('/api/property/autofill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedApi,
                    intent: 'step1',
                    address: manualAddress || initialData?.address || undefined,
                    lat: initialData?.lat,
                    lng: initialData?.lng,
                    apn: existingApn || undefined,
                    fips_code: initialData?.fips_code,
                    county: initialData?.county,
                    city: initialData?.city || extractCityFromAddressString(manualAddress),
                    state: initialData?.state || extractStateFromAddressString(manualAddress),
                    zip_code: initialData?.zip_code,
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || 'Auto-fill request failed');
            }

            if (!payload?.apn_found) {
                setAttomMessage(payload?.message || `No APN/Assessor ID found via address or coordinates for ${selectedApi}.`);
                const updates: Record<string, any> = {};
                const pdfParcel = pdfValues.parcel_1 || pdfValues.parcelNumber;
                if (isEmptyOrDefault('owner_name', initialData?.owner_name) && pdfValues.owner_name) updates.owner_name = pdfValues.owner_name;
                if (isEmptyOrDefault('parcel_1', initialData?.parcel_1) && pdfParcel) updates.parcel_1 = pdfParcel;
                if (isEmptyOrDefault('parcelNumber', initialData?.parcelNumber) && pdfParcel) updates.parcelNumber = pdfParcel;
                if (isEmptyOrDefault('parcel_1_acreage', initialData?.parcel_1_acreage) && pdfValues.parcel_1_acreage) updates.parcel_1_acreage = pdfValues.parcel_1_acreage;
                if (isEmptyOrDefault('acreage', initialData?.acreage) && pdfValues.acreage) updates.acreage = pdfValues.acreage;
                if (isEmptyOrDefault('property_type', initialData?.property_type) && pdfValues.property_type) updates.property_type = pdfValues.property_type;
                if (isEmptyOrDefault('year_built', initialData?.year_built) && pdfValues.year_built) updates.year_built = pdfValues.year_built;
                if (isEmptyOrDefault('last_sale_price', initialData?.last_sale_price) && pdfValues.last_sale_price) updates.last_sale_price = pdfValues.last_sale_price;
                if (Object.keys(updates).length > 0) onDataChange(updates);
                return;
            }

            const identity = payload?.property_identity || {};
            const financials = payload?.financials || {};
            const demographics = payload?.demographics_economics || {};
            const housing = payload?.housing_crisis_metrics || {};
            const demographicsDetails = payload?.demographics_details || null;
            const incomingSnapshot = sanitizeApiSnapshot(payload?.api_snapshot || {});
            const normalizedApn = normalizeParcelIdentifier(identity.apn);

            const updates: Record<string, any> = {
                mobile_home_park_name: manualName || initialData?.mobile_home_park_name,
            };
            const assignIfAllowed = (fieldKey: string, nextValue: any) => {
                if (
                    shouldApplyApiValue({
                        fieldKey,
                        nextValue,
                        currentValue: initialData?.[fieldKey],
                        defaultValues,
                        previousApiValues: apiValues,
                    })
                ) {
                    updates[fieldKey] = nextValue;
                }
            };

            assignIfAllowed('owner_name', identity.owner);
            assignIfAllowed('fips_code', identity.fips_code);
            assignIfAllowed('parcelNumber', normalizedApn);
            assignIfAllowed('parcel_1', normalizedApn);
            assignIfAllowed('acreage', identity.acreage);
            assignIfAllowed('parcel_1_acreage', identity.acreage);
            assignIfAllowed('year_built', identity.year_built);
            assignIfAllowed('property_type', identity.property_type);
            assignIfAllowed('last_sale_price', financials.last_sale_price);
            assignIfAllowed('population', demographics.population);
            assignIfAllowed('population_change', demographics.population_change);
            assignIfAllowed('median_household_income', demographics.median_household_income);
            assignIfAllowed('median_household_income_change', demographics.median_household_income_change);
            assignIfAllowed('poverty_rate', demographics.poverty_rate);
            assignIfAllowed('number_of_employees', demographics.number_of_employees);
            assignIfAllowed('number_of_employees_change', demographics.number_of_employees_change);
            assignIfAllowed('median_property_value', demographics.median_property_value);
            assignIfAllowed('median_property_value_change', demographics.median_property_value_change);
            assignIfAllowed('violent_crime', demographics.violent_crime);
            assignIfAllowed('property_crime', demographics.property_crime);
            assignIfAllowed('two_br_rent', demographics.two_br_rent);
            assignIfAllowed('eli_renter_households', housing.eli_renter_households);
            assignIfAllowed('units_per_100', housing.affordable_units_per_100);
            assignIfAllowed('total_units', housing.total_units);

            if (demographicsDetails && shouldFillWithAttom(initialData?.demographics_details, 'demographics_details')) {
                updates.demographics_details = demographicsDetails;
            }

            if (Object.keys(incomingSnapshot).length > 0) {
                updates.api_values = {
                    ...(initialData?.api_values || {}),
                    ...incomingSnapshot,
                };
            }
            if (Object.keys(updates).length > 0) {
                onDataChange(updates);
            }
            setAttomMessage(payload?.message || 'AI: data found.');
        } catch (error: any) {
            console.warn('Autofill failed:', error?.message || error);
            setAttomError(error.message || 'Auto-fill request failed');
        } finally {
            setAttomLoading(false);
        }
    };
    
    if (!hasApiKey) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-3">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Location & Details</h2>
                    <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg">
                        <h3 className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined">warning</span>
                            Missing Google Maps API Key
                        </h3>
                        <p className="text-sm text-red-500 dark:text-red-300 mt-2">
                            The Google Maps API key is missing or invalid. Please update <code>.env.local</code>.
                        </p>
                    </div>
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Mobile Home Park Name"
                        fieldKey="mobile_home_park_name"
                        currentValue={manualName}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={manualName}
                        onChange={e => {
                            setManualName(e.target.value);
                            onDataChange({
                                name: e.target.value,
                                mobile_home_park_name: e.target.value,
                                address: manualAddress,
                                mobile_home_park_address: manualAddress,
                            });
                        }}
                        placeholder="e.g., Sunset RV Park"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Mobile Home Park Address"
                        fieldKey="mobile_home_park_address"
                        currentValue={manualAddress}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={manualAddress}
                        onChange={e => {
                            setManualAddress(e.target.value);
                            onDataChange({
                                name: manualName,
                                address: e.target.value,
                                mobile_home_park_address: e.target.value,
                                mobile_home_park_name: manualName,
                            });
                        }}
                        onBlur={e =>
                            onDataChange({
                                name: manualName,
                                address: e.target.value,
                                mobile_home_park_address: e.target.value,
                                mobile_home_park_name: manualName,
                            })
                        } // Ensure save on blur for manual entry
                        placeholder="Enter address manually..."
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Owner Name"
                        fieldKey="owner_name"
                        currentValue={initialData?.owner_name ?? ''}
                        pdfValues={pdfValues}
                        apiValues={apiValues}
                    />
                    <Input
                        value={initialData?.owner_name ?? ''}
                        onChange={(e) => onDataChange({ owner_name: e.target.value })}
                        placeholder="Auto-filled from PDF or API"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={fetchAttomData}
                        disabled={attomLoading || (!manualAddress && !(initialData?.parcel_1 || initialData?.parcelNumber || pdfValues?.parcel_1 || pdfValues?.parcelNumber))}
                        variant="outline"
                        className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                    >
                        {attomLoading ? "Fetching..." : "AI Auto-Fill"}
                    </Button>
                    {attomError && (
                        <span className="text-sm text-red-600 dark:text-red-400">{attomError}</span>
                    )}
                    {attomMessage && !attomError && (
                        <span className="text-sm text-blue-600 dark:text-blue-300">{attomMessage}</span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <DiscrepancyLabel
                            label="City"
                            fieldKey="city"
                            currentValue={initialData?.city ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.city ?? ''}
                            onChange={(e) => onDataChange({ city: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="State"
                            fieldKey="state"
                            currentValue={initialData?.state ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.state ?? ''}
                            onChange={(e) => onDataChange({ state: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="County"
                            fieldKey="county"
                            currentValue={initialData?.county ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.county ?? ''}
                            onChange={(e) => onDataChange({ county: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Zip Code"
                            fieldKey="zip_code"
                            currentValue={initialData?.zip_code ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.zip_code ?? ''}
                            onChange={(e) => onDataChange({ zip_code: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="FIPS Code"
                            fieldKey="fips_code"
                            currentValue={initialData?.fips_code ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.fips_code ?? ''}
                            onChange={(e) => onDataChange({ fips_code: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Parcel Number"
                            fieldKey="parcel_1"
                            currentValue={(initialData?.parcel_1 ?? '') || (initialData?.parcelNumber ?? '')}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={(initialData?.parcel_1 ?? '') || (initialData?.parcelNumber ?? '')}
                            onChange={(e) => {
                                const normalized = e.target.value.replace(/[\s-]+/g, '').trim();
                                onDataChange({ parcel_1: normalized, parcelNumber: normalized });
                            }}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Acreage (Acres)"
                            fieldKey="parcel_1_acreage"
                            currentValue={(initialData?.parcel_1_acreage ?? '') || (initialData?.acreage ?? '')}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            type="number"
                            value={(initialData?.parcel_1_acreage ?? '') || (initialData?.acreage ?? '')}
                            onChange={(e) => onDataChange({ parcel_1_acreage: e.target.value, acreage: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Year Built"
                            fieldKey="year_built"
                            currentValue={initialData?.year_built ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.year_built ?? ''}
                            onChange={(e) => onDataChange({ year_built: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Property Type"
                            fieldKey="property_type"
                            currentValue={initialData?.property_type ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <Input
                            value={initialData?.property_type ?? ''}
                            onChange={(e) => onDataChange({ property_type: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Last Sale Price"
                            fieldKey="last_sale_price"
                            currentValue={initialData?.last_sale_price ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.last_sale_price ?? ''}
                                onChange={(e) => onDataChange({ last_sale_price: e.target.value })}
                                placeholder="Auto-fetched"
                                className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white pl-8"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Demographics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <DiscrepancyLabel
                                label="Population"
                                fieldKey="population"
                                currentValue={initialData?.population ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                        <Input
                            type="number"
                            value={initialData?.population ?? ''}
                            onChange={(e) => onDataChange({ population: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                        </div>
                    <div>
                        <DiscrepancyLabel
                            label="Population % Change"
                            fieldKey="population_change"
                            currentValue={initialData?.population_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.population_change ?? ''}
                                onChange={(e) => onDataChange({ population_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Poverty Rate"
                            fieldKey="poverty_rate"
                            currentValue={initialData?.poverty_rate ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.poverty_rate ?? ''}
                                onChange={(e) => onDataChange({ poverty_rate: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income"
                            fieldKey="median_household_income"
                            currentValue={initialData?.median_household_income ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_household_income ?? ''}
                                onChange={(e) => onDataChange({ median_household_income: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income % Change"
                            fieldKey="median_household_income_change"
                            currentValue={initialData?.median_household_income_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_household_income_change ?? ''}
                                onChange={(e) => onDataChange({ median_household_income_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                        <div>
                            <DiscrepancyLabel
                                label="Number of Employees"
                                fieldKey="number_of_employees"
                                currentValue={initialData?.number_of_employees ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                        <Input
                            type="number"
                            value={initialData?.number_of_employees ?? ''}
                            onChange={(e) => onDataChange({ number_of_employees: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                        </div>
                    <div>
                        <DiscrepancyLabel
                            label="Number of Employees % Change"
                            fieldKey="number_of_employees_change"
                            currentValue={initialData?.number_of_employees_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.number_of_employees_change ?? ''}
                                onChange={(e) => onDataChange({ number_of_employees_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value"
                            fieldKey="median_property_value"
                            currentValue={initialData?.median_property_value ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_property_value ?? ''}
                                onChange={(e) => onDataChange({ median_property_value: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value % Change"
                            fieldKey="median_property_value_change"
                            currentValue={initialData?.median_property_value_change ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_property_value_change ?? ''}
                                onChange={(e) => onDataChange({ median_property_value_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                    </div>
                        <div>
                            <DiscrepancyLabel
                                label="Violent Crime"
                                fieldKey="violent_crime"
                                currentValue={initialData?.violent_crime ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                            <Input
                                value={initialData?.violent_crime ?? ''}
                                onChange={(e) => onDataChange({ violent_crime: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                        <div>
                            <DiscrepancyLabel
                                label="Property Crime"
                                fieldKey="property_crime"
                                currentValue={initialData?.property_crime ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                            <Input
                                value={initialData?.property_crime ?? ''}
                                onChange={(e) => onDataChange({ property_crime: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                    <div>
                        <DiscrepancyLabel
                            label="2 BR Rent"
                            fieldKey="two_br_rent"
                            currentValue={initialData?.two_br_rent ?? ''}
                            pdfValues={pdfValues}
                        apiValues={apiValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.two_br_rent ?? ''}
                                onChange={(e) => onDataChange({ two_br_rent: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                        <div>
                            <DiscrepancyLabel
                                label="ELI Renter Households"
                                fieldKey="eli_renter_households"
                                currentValue={initialData?.eli_renter_households ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                            <Input
                                value={initialData?.eli_renter_households ?? ''}
                                onChange={(e) => onDataChange({ eli_renter_households: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                        <div>
                            <DiscrepancyLabel
                                label="Units per 100"
                                fieldKey="units_per_100"
                                currentValue={initialData?.units_per_100 ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                            <Input
                                value={initialData?.units_per_100 ?? ''}
                                onChange={(e) => onDataChange({ units_per_100: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                        <div>
                            <DiscrepancyLabel
                                label="Total Units"
                                fieldKey="total_units"
                                currentValue={initialData?.total_units ?? ''}
                                pdfValues={pdfValues}
                        apiValues={apiValues}
                            />
                            <Input
                                value={initialData?.total_units ?? ''}
                                onChange={(e) => onDataChange({ total_units: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                    </div>
                    {initialData?.demographics_details && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setShowMoreDemographics((prev) => !prev)}
                                className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300"
                            >
                                <span className={`material-symbols-outlined transition-transform ${showMoreDemographics ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                                More demographics
                            </button>
                            {showMoreDemographics && (
                                <div className="mt-4">
                                    <DemographicsDetails details={initialData.demographics_details} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return <GooglePlacesInput onDataChange={onDataChange} initialData={initialData} onBusyChange={onBusyChange} selectedApi={selectedApi} />;
};
