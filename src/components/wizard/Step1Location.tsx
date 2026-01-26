"use client";

import React, { useState } from 'react';
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from "use-places-autocomplete";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DiscrepancyLabel } from "@/components/ui/DiscrepancyLabel";

interface Step1Props {
    onDataChange: (data: any) => void;
    initialData?: any;
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
    const stateZip = parts[2] || '';
    return stateZip.split(' ')[0] || '';
};

const extractCityFromGeocode = (result: any) => {
    const components = result?.address_components || [];
    const findComponent = (type: string) =>
        components.find((component: any) => component.types?.includes(type))?.long_name || '';

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

const GooglePlacesInput = ({ onDataChange, initialData }: Step1Props) => {
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
    const [projectName, setProjectName] = useState(initialData?.name || '');
    const [attomLoading, setAttomLoading] = useState(false);
    const [attomError, setAttomError] = useState<string | null>(null);
    const [attomMessage, setAttomMessage] = useState<string | null>(null);
    const [showMoreDemographics, setShowMoreDemographics] = useState(false);
    const lastAttomAddressRef = React.useRef<string>('');
    const lastGeocodedAddressRef = React.useRef<string>('');
    const pdfValues = initialData?.pdf_values || {};
    const isEmptyValue = (value: any) =>
        value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

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
        const address = initialData?.address;
        if (!address || !ready) return;
        if (initialData?.lat && initialData?.lng) return;
        if (lastGeocodedAddressRef.current === address) return;

        lastGeocodedAddressRef.current = address;
        let isActive = true;

        getGeocode({ address })
            .then((results) => {
                if (!isActive || !results?.[0]) return;
                const { lat, lng } = getLatLng(results[0]);
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
    }, [initialData?.address, initialData?.lat, initialData?.lng, initialData?.city, initialData?.county, onDataChange, ready]);

    const normalizeComparable = (value: any) =>
        String(value ?? '')
            .toLowerCase()
            .replace(/[\s-]+/g, '')
            .trim();
    const shouldOverrideWithAttom = (currentValue: any, pdfValue: any) =>
        isEmptyValue(currentValue) || normalizeComparable(currentValue) === normalizeComparable(pdfValue);

    const applyAttomData = (payload: any) => {
        const identity = payload?.property_identity;
        if (!identity) return;

        const financials = payload?.financials || {};
        const demographics = payload?.demographics_economics || {};
        const housing = payload?.housing_crisis_metrics || {};
        const demographicsDetails = payload?.demographics_details || null;

        const updates: Record<string, any> = {};
        if (identity.apn && shouldOverrideWithAttom(initialData?.parcelNumber, pdfValues.parcelNumber)) {
            updates.parcelNumber = identity.apn;
        }
        if (identity.apn && shouldOverrideWithAttom(initialData?.parcel_1, pdfValues.parcel_1)) {
            updates.parcel_1 = identity.apn;
        }
        if (identity.fips_code && isEmptyValue(initialData?.fips_code)) {
            updates.fips_code = identity.fips_code;
        }
        if (identity.acreage && shouldOverrideWithAttom(initialData?.acreage, pdfValues.acreage)) {
            updates.acreage = identity.acreage;
        }
        if (identity.acreage && shouldOverrideWithAttom(initialData?.parcel_1_acreage, pdfValues.parcel_1_acreage)) {
            updates.parcel_1_acreage = identity.acreage;
        }
        if (identity.year_built && shouldOverrideWithAttom(initialData?.year_built, pdfValues.year_built)) {
            updates.year_built = identity.year_built;
        }
        if (identity.property_type && shouldOverrideWithAttom(initialData?.property_type, pdfValues.property_type)) {
            updates.property_type = identity.property_type;
        }
        if (financials.last_sale_price && shouldOverrideWithAttom(initialData?.last_sale_price, pdfValues.last_sale_price)) {
            updates.last_sale_price = financials.last_sale_price;
        }
        if (!initialData?.mobile_home_park_name && initialData?.name) updates.mobile_home_park_name = initialData.name;

        if (!initialData?.population && demographics.population) updates.population = demographics.population;
        if (!initialData?.population_change && demographics.population_change) {
            updates.population_change = demographics.population_change;
        }
        if (!initialData?.median_household_income && demographics.median_household_income) {
            updates.median_household_income = demographics.median_household_income;
        }
        if (!initialData?.median_household_income_change && demographics.median_household_income_change) {
            updates.median_household_income_change = demographics.median_household_income_change;
        }
        if (!initialData?.poverty_rate && demographics.poverty_rate) updates.poverty_rate = demographics.poverty_rate;
        if (!initialData?.number_of_employees && demographics.number_of_employees) {
            updates.number_of_employees = demographics.number_of_employees;
        }
        if (!initialData?.number_of_employees_change && demographics.number_of_employees_change) {
            updates.number_of_employees_change = demographics.number_of_employees_change;
        }
        if (!initialData?.median_property_value && demographics.median_property_value) {
            updates.median_property_value = demographics.median_property_value;
        }
        if (!initialData?.median_property_value_change && demographics.median_property_value_change) {
            updates.median_property_value_change = demographics.median_property_value_change;
        }
        if (!initialData?.violent_crime && demographics.violent_crime) {
            updates.violent_crime = demographics.violent_crime;
        }
        if (!initialData?.property_crime && demographics.property_crime) {
            updates.property_crime = demographics.property_crime;
        }
        if (!initialData?.two_br_rent && demographics.two_br_rent) {
            updates.two_br_rent = demographics.two_br_rent;
        }
        if (!initialData?.eli_renter_households && housing.eli_renter_households) {
            updates.eli_renter_households = housing.eli_renter_households;
        }
        if (!initialData?.units_per_100 && housing.affordable_units_per_100) {
            updates.units_per_100 = housing.affordable_units_per_100;
        }
        if (!initialData?.total_units && housing.total_units) updates.total_units = housing.total_units;
        if (demographicsDetails && !initialData?.demographics_details) {
            updates.demographics_details = demographicsDetails;
        }

        if (Object.keys(updates).length > 0) {
            onDataChange(updates);
        }
    };

    const applyPdfFallback = () => {
        if (!pdfValues) return;
        const updates: Record<string, any> = {};
        const pdfParcel = pdfValues.parcel_1 || pdfValues.parcelNumber;
        if (isEmptyValue(initialData?.parcel_1) && pdfParcel) updates.parcel_1 = pdfParcel;
        if (isEmptyValue(initialData?.parcelNumber) && pdfParcel) updates.parcelNumber = pdfParcel;
        if (isEmptyValue(initialData?.parcel_1_acreage) && pdfValues.parcel_1_acreage) {
            updates.parcel_1_acreage = pdfValues.parcel_1_acreage;
        }
        if (isEmptyValue(initialData?.acreage) && pdfValues.acreage) updates.acreage = pdfValues.acreage;
        if (isEmptyValue(initialData?.property_type) && pdfValues.property_type) updates.property_type = pdfValues.property_type;
        if (isEmptyValue(initialData?.year_built) && pdfValues.year_built) updates.year_built = pdfValues.year_built;
        if (isEmptyValue(initialData?.last_sale_price) && pdfValues.last_sale_price) {
            updates.last_sale_price = pdfValues.last_sale_price;
        }
        if (Object.keys(updates).length > 0) {
            onDataChange(updates);
        }
    };

    const fetchAttomData = async (addressToUse: string, coords?: { lat: number; lng: number }) => {
        if (!addressToUse) return;
        setAttomLoading(true);
        setAttomError(null);
        setAttomMessage(null);
        try {
            const response = await fetch('/api/attom/property', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: addressToUse, lat: coords?.lat, lng: coords?.lng }),
            });
            const payload = await response.json();
            if (!response.ok) {
                if (response.status === 404) {
                    setAttomMessage('ATTOM: no results found');
                    applyPdfFallback();
                    return;
                }
                throw new Error(payload?.error || 'ATTOM request failed');
            }
            applyAttomData(payload);
            setAttomMessage(`ATTOM: data found${payload?.source ? ` (${payload.source})` : ''}`);
        } catch (error: any) {
            console.error('ATTOM fetch failed:', error);
            setAttomError(error.message || 'ATTOM request failed');
            applyPdfFallback();
        } finally {
            setAttomLoading(false);
        }
    };

    const geocodeAddress = async (addressToUse: string) => {
        const results = await getGeocode({ address: addressToUse });
        if (!results?.[0]) return null;
        const { lat, lng } = await getLatLng(results[0]);
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
        onDataChange(payload);
        return { lat, lng };
    };

    const handleSelect = async (address: string) => {
        setValue(address, false);
        clearSuggestions();

        try {
            const coords = await geocodeAddress(address);
            void fetchAttomData(address, coords || undefined);
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const handleManualAddress = async () => {
        if (!value) return;
        try {
            const coords = await geocodeAddress(value);
            void fetchAttomData(value, coords || undefined);
        } catch (error) {
            console.error("Error: ", error);
        }
    };
    
    React.useEffect(() => {
        const address = initialData?.address;
        if (!address || attomLoading) return;
        const key = `${address}-${coordinates?.lat ?? ''}-${coordinates?.lng ?? ''}`;
        if (lastAttomAddressRef.current === key) return;
        lastAttomAddressRef.current = key;
        void fetchAttomData(address, coordinates || undefined);
    }, [initialData?.address, attomLoading, coordinates]);

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
                <div className="flex items-center justify-between mb-2">
                    <DiscrepancyLabel
                        label="Mobile Home Park Address"
                        fieldKey="mobile_home_park_address"
                        currentValue={value}
                        pdfValues={pdfValues}
                        className="mb-0"
                    />
                    <Button
                        onClick={handleManualAddress}
                        disabled={attomLoading || !value}
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
                        onBlur={handleManualAddress}
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
                        currentValue={initialData?.city || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.city || ''}
                        onChange={(e) => onDataChange({ city: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="State"
                        fieldKey="state"
                        currentValue={initialData?.state || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.state || ''}
                        onChange={(e) => onDataChange({ state: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="County"
                        fieldKey="county"
                        currentValue={initialData?.county || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.county || ''}
                        onChange={(e) => onDataChange({ county: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Zip Code"
                        fieldKey="zip_code"
                        currentValue={initialData?.zip_code || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.zip_code || ''}
                        onChange={(e) => onDataChange({ zip_code: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="FIPS Code"
                        fieldKey="fips_code"
                        currentValue={initialData?.fips_code || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.fips_code || ''}
                        onChange={(e) => onDataChange({ fips_code: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Parcel Number"
                        fieldKey="parcel_1"
                        currentValue={initialData?.parcel_1 || initialData?.parcelNumber || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.parcel_1 || initialData?.parcelNumber || ''}
                        onChange={(e) => onDataChange({ parcel_1: e.target.value, parcelNumber: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Acreage (Acres)"
                        fieldKey="parcel_1_acreage"
                        currentValue={initialData?.parcel_1_acreage || initialData?.acreage || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        type="number"
                        value={initialData?.parcel_1_acreage || initialData?.acreage || ''}
                        onChange={(e) => onDataChange({ parcel_1_acreage: e.target.value, acreage: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Year Built"
                        fieldKey="year_built"
                        currentValue={initialData?.year_built || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        type="number"
                        value={initialData?.year_built || ''}
                        onChange={(e) => onDataChange({ year_built: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Property Type"
                        fieldKey="property_type"
                        currentValue={initialData?.property_type || ''}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={initialData?.property_type || ''}
                        onChange={(e) => onDataChange({ property_type: e.target.value })}
                        placeholder="Auto-fetched"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Last Sale Price"
                        fieldKey="last_sale_price"
                        currentValue={initialData?.last_sale_price || ''}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={initialData?.last_sale_price || ''}
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
                            currentValue={initialData?.population || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.population || ''}
                            onChange={(e) => onDataChange({ population: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Population % Change"
                            fieldKey="population_change"
                            currentValue={initialData?.population_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.population_change || ''}
                                onChange={(e) => onDataChange({ population_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Poverty Rate"
                            fieldKey="poverty_rate"
                            currentValue={initialData?.poverty_rate || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.poverty_rate || ''}
                                onChange={(e) => onDataChange({ poverty_rate: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income"
                            fieldKey="median_household_income"
                            currentValue={initialData?.median_household_income || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_household_income || ''}
                                onChange={(e) => onDataChange({ median_household_income: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income % Change"
                            fieldKey="median_household_income_change"
                            currentValue={initialData?.median_household_income_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_household_income_change || ''}
                                onChange={(e) => onDataChange({ median_household_income_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Number of Employees"
                            fieldKey="number_of_employees"
                            currentValue={initialData?.number_of_employees || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.number_of_employees || ''}
                            onChange={(e) => onDataChange({ number_of_employees: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Number of Employees % Change"
                            fieldKey="number_of_employees_change"
                            currentValue={initialData?.number_of_employees_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.number_of_employees_change || ''}
                                onChange={(e) => onDataChange({ number_of_employees_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value"
                            fieldKey="median_property_value"
                            currentValue={initialData?.median_property_value || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_property_value || ''}
                                onChange={(e) => onDataChange({ median_property_value: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value % Change"
                            fieldKey="median_property_value_change"
                            currentValue={initialData?.median_property_value_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_property_value_change || ''}
                                onChange={(e) => onDataChange({ median_property_value_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Violent Crime"
                            fieldKey="violent_crime"
                            currentValue={initialData?.violent_crime || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.violent_crime || ''}
                            onChange={(e) => onDataChange({ violent_crime: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Property Crime"
                            fieldKey="property_crime"
                            currentValue={initialData?.property_crime || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.property_crime || ''}
                            onChange={(e) => onDataChange({ property_crime: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="2 BR Rent"
                            fieldKey="two_br_rent"
                            currentValue={initialData?.two_br_rent || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.two_br_rent || ''}
                                onChange={(e) => onDataChange({ two_br_rent: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="ELI Renter Households"
                            fieldKey="eli_renter_households"
                            currentValue={initialData?.eli_renter_households || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.eli_renter_households || ''}
                            onChange={(e) => onDataChange({ eli_renter_households: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Units per 100"
                            fieldKey="units_per_100"
                            currentValue={initialData?.units_per_100 || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.units_per_100 || ''}
                            onChange={(e) => onDataChange({ units_per_100: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Total Units"
                            fieldKey="total_units"
                            currentValue={initialData?.total_units || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.total_units || ''}
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

export const Step1Location: React.FC<Step1Props> = ({ onDataChange, initialData }) => {
    const hasApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY.includes('placeholder');
    const [manualName, setManualName] = React.useState(initialData?.name || '');
    const [manualAddress, setManualAddress] = React.useState(initialData?.address || '');
    const [attomLoading, setAttomLoading] = React.useState(false);
    const [attomError, setAttomError] = React.useState<string | null>(null);
    const [attomMessage, setAttomMessage] = React.useState<string | null>(null);
    const [showMoreDemographics, setShowMoreDemographics] = React.useState(false);
    const lastAttomAddressRef = React.useRef<string>('');
    const pdfValues = initialData?.pdf_values || {};
    const isEmptyValue = (value: any) =>
        value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

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

    const fetchAttomData = async () => {
        if (!manualAddress) return;
        setAttomLoading(true);
        setAttomError(null);
        setAttomMessage(null);
        try {
            const response = await fetch('/api/attom/property', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: manualAddress }),
            });
            const payload = await response.json();
            if (!response.ok) {
                if (response.status === 404) {
                    setAttomMessage('ATTOM: no results found');
                    const updates: Record<string, any> = {};
                    const pdfParcel = pdfValues.parcel_1 || pdfValues.parcelNumber;
                    if (isEmptyValue(initialData?.parcel_1) && pdfParcel) updates.parcel_1 = pdfParcel;
                    if (isEmptyValue(initialData?.parcelNumber) && pdfParcel) updates.parcelNumber = pdfParcel;
                    if (isEmptyValue(initialData?.parcel_1_acreage) && pdfValues.parcel_1_acreage) {
                        updates.parcel_1_acreage = pdfValues.parcel_1_acreage;
                    }
                    if (isEmptyValue(initialData?.acreage) && pdfValues.acreage) updates.acreage = pdfValues.acreage;
                    if (isEmptyValue(initialData?.property_type) && pdfValues.property_type) updates.property_type = pdfValues.property_type;
                    if (isEmptyValue(initialData?.year_built) && pdfValues.year_built) updates.year_built = pdfValues.year_built;
                    if (isEmptyValue(initialData?.last_sale_price) && pdfValues.last_sale_price) {
                        updates.last_sale_price = pdfValues.last_sale_price;
                    }
                    if (Object.keys(updates).length > 0) {
                        onDataChange(updates);
                    }
                    return;
                }
                throw new Error(payload?.error || 'ATTOM request failed');
            }
            const identity = payload?.property_identity || {};
            const financials = payload?.financials || {};
            const demographics = payload?.demographics_economics || {};
            const housing = payload?.housing_crisis_metrics || {};
            const demographicsDetails = payload?.demographics_details || null;
            setAttomMessage(`ATTOM: data found${payload?.source ? ` (${payload.source})` : ''}`);
            const normalizeComparable = (value: any) =>
                String(value ?? '')
                    .toLowerCase()
                    .replace(/[\s-]+/g, '')
                    .trim();
            const shouldOverrideWithAttom = (currentValue: any, pdfValue: any) =>
                isEmptyValue(currentValue) || normalizeComparable(currentValue) === normalizeComparable(pdfValue);
            const updates: Record<string, any> = {
                mobile_home_park_name: manualName || initialData?.mobile_home_park_name,
                population: demographics.population ?? initialData?.population,
                population_change: demographics.population_change ?? initialData?.population_change,
                median_household_income: demographics.median_household_income ?? initialData?.median_household_income,
                median_household_income_change: demographics.median_household_income_change ?? initialData?.median_household_income_change,
                poverty_rate: demographics.poverty_rate ?? initialData?.poverty_rate,
                number_of_employees: demographics.number_of_employees ?? initialData?.number_of_employees,
                number_of_employees_change: demographics.number_of_employees_change ?? initialData?.number_of_employees_change,
                median_property_value: demographics.median_property_value ?? initialData?.median_property_value,
                median_property_value_change: demographics.median_property_value_change ?? initialData?.median_property_value_change,
                violent_crime: demographics.violent_crime ?? initialData?.violent_crime,
                property_crime: demographics.property_crime ?? initialData?.property_crime,
                two_br_rent: demographics.two_br_rent ?? initialData?.two_br_rent,
                eli_renter_households: housing.eli_renter_households ?? initialData?.eli_renter_households,
                units_per_100: housing.affordable_units_per_100 ?? initialData?.units_per_100,
                total_units: housing.total_units ?? initialData?.total_units,
            };
            if (demographicsDetails && !initialData?.demographics_details) {
                updates.demographics_details = demographicsDetails;
            }
            if (identity.fips_code && isEmptyValue(initialData?.fips_code)) {
                updates.fips_code = identity.fips_code;
            }
            if (identity.apn && shouldOverrideWithAttom(initialData?.parcelNumber, pdfValues.parcelNumber)) {
                updates.parcelNumber = identity.apn;
            }
            if (identity.apn && shouldOverrideWithAttom(initialData?.parcel_1, pdfValues.parcel_1)) {
                updates.parcel_1 = identity.apn;
            }
            if (identity.acreage && shouldOverrideWithAttom(initialData?.acreage, pdfValues.acreage)) {
                updates.acreage = identity.acreage;
            }
            if (identity.acreage && shouldOverrideWithAttom(initialData?.parcel_1_acreage, pdfValues.parcel_1_acreage)) {
                updates.parcel_1_acreage = identity.acreage;
            }
            if (identity.year_built && shouldOverrideWithAttom(initialData?.year_built, pdfValues.year_built)) {
                updates.year_built = identity.year_built;
            }
            if (identity.property_type && shouldOverrideWithAttom(initialData?.property_type, pdfValues.property_type)) {
                updates.property_type = identity.property_type;
            }
            if (financials.last_sale_price && shouldOverrideWithAttom(initialData?.last_sale_price, pdfValues.last_sale_price)) {
                updates.last_sale_price = financials.last_sale_price;
            }
            onDataChange(updates);
        } catch (error: any) {
            console.error('ATTOM fetch failed:', error);
            setAttomError(error.message || 'ATTOM request failed');
            const updates: Record<string, any> = {};
            const pdfParcel = pdfValues.parcel_1 || pdfValues.parcelNumber;
            if (isEmptyValue(initialData?.parcel_1) && pdfParcel) updates.parcel_1 = pdfParcel;
            if (isEmptyValue(initialData?.parcelNumber) && pdfParcel) updates.parcelNumber = pdfParcel;
            if (isEmptyValue(initialData?.parcel_1_acreage) && pdfValues.parcel_1_acreage) {
                updates.parcel_1_acreage = pdfValues.parcel_1_acreage;
            }
            if (isEmptyValue(initialData?.acreage) && pdfValues.acreage) updates.acreage = pdfValues.acreage;
            if (isEmptyValue(initialData?.property_type) && pdfValues.property_type) updates.property_type = pdfValues.property_type;
            if (isEmptyValue(initialData?.year_built) && pdfValues.year_built) updates.year_built = pdfValues.year_built;
            if (isEmptyValue(initialData?.last_sale_price) && pdfValues.last_sale_price) {
                updates.last_sale_price = pdfValues.last_sale_price;
            }
            if (Object.keys(updates).length > 0) {
                onDataChange(updates);
            }
        } finally {
            setAttomLoading(false);
        }
    };
    
    React.useEffect(() => {
        if (!manualAddress || attomLoading) return;
        if (!manualAddress.includes(',') || manualAddress.length < 8) return;
        if (lastAttomAddressRef.current === manualAddress) return;
        lastAttomAddressRef.current = manualAddress;
        const timer = setTimeout(() => {
            void fetchAttomData();
        }, 700);
        return () => clearTimeout(timer);
    }, [manualAddress, attomLoading]);

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

                <div className="flex items-center gap-3">
                    <Button
                        onClick={fetchAttomData}
                        disabled={attomLoading || !manualAddress}
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
                            currentValue={initialData?.city || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.city || ''}
                            onChange={(e) => onDataChange({ city: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="State"
                            fieldKey="state"
                            currentValue={initialData?.state || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.state || ''}
                            onChange={(e) => onDataChange({ state: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="County"
                            fieldKey="county"
                            currentValue={initialData?.county || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.county || ''}
                            onChange={(e) => onDataChange({ county: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Zip Code"
                            fieldKey="zip_code"
                            currentValue={initialData?.zip_code || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.zip_code || ''}
                            onChange={(e) => onDataChange({ zip_code: e.target.value })}
                            placeholder="Enter manually"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="FIPS Code"
                            fieldKey="fips_code"
                            currentValue={initialData?.fips_code || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.fips_code || ''}
                            onChange={(e) => onDataChange({ fips_code: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Parcel Number"
                            fieldKey="parcel_1"
                            currentValue={initialData?.parcel_1 || initialData?.parcelNumber || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.parcel_1 || initialData?.parcelNumber || ''}
                            onChange={(e) => onDataChange({ parcel_1: e.target.value, parcelNumber: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Acreage (Acres)"
                            fieldKey="parcel_1_acreage"
                            currentValue={initialData?.parcel_1_acreage || initialData?.acreage || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.parcel_1_acreage || initialData?.acreage || ''}
                            onChange={(e) => onDataChange({ parcel_1_acreage: e.target.value, acreage: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Year Built"
                            fieldKey="year_built"
                            currentValue={initialData?.year_built || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            type="number"
                            value={initialData?.year_built || ''}
                            onChange={(e) => onDataChange({ year_built: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Property Type"
                            fieldKey="property_type"
                            currentValue={initialData?.property_type || ''}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={initialData?.property_type || ''}
                            onChange={(e) => onDataChange({ property_type: e.target.value })}
                            placeholder="Auto-fetched"
                            className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Last Sale Price"
                            fieldKey="last_sale_price"
                            currentValue={initialData?.last_sale_price || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.last_sale_price || ''}
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
                                currentValue={initialData?.population || ''}
                                pdfValues={pdfValues}
                            />
                        <Input
                            type="number"
                            value={initialData?.population || ''}
                            onChange={(e) => onDataChange({ population: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                        </div>
                    <div>
                        <DiscrepancyLabel
                            label="Population % Change"
                            fieldKey="population_change"
                            currentValue={initialData?.population_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.population_change || ''}
                                onChange={(e) => onDataChange({ population_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Poverty Rate"
                            fieldKey="poverty_rate"
                            currentValue={initialData?.poverty_rate || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.poverty_rate || ''}
                                onChange={(e) => onDataChange({ poverty_rate: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income"
                            fieldKey="median_household_income"
                            currentValue={initialData?.median_household_income || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_household_income || ''}
                                onChange={(e) => onDataChange({ median_household_income: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Household Income % Change"
                            fieldKey="median_household_income_change"
                            currentValue={initialData?.median_household_income_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_household_income_change || ''}
                                onChange={(e) => onDataChange({ median_household_income_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                        <div>
                            <DiscrepancyLabel
                                label="Number of Employees"
                                fieldKey="number_of_employees"
                                currentValue={initialData?.number_of_employees || ''}
                                pdfValues={pdfValues}
                            />
                        <Input
                            type="number"
                            value={initialData?.number_of_employees || ''}
                            onChange={(e) => onDataChange({ number_of_employees: e.target.value })}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                        </div>
                    <div>
                        <DiscrepancyLabel
                            label="Number of Employees % Change"
                            fieldKey="number_of_employees_change"
                            currentValue={initialData?.number_of_employees_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.number_of_employees_change || ''}
                                onChange={(e) => onDataChange({ number_of_employees_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value"
                            fieldKey="median_property_value"
                            currentValue={initialData?.median_property_value || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.median_property_value || ''}
                                onChange={(e) => onDataChange({ median_property_value: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                    <div>
                        <DiscrepancyLabel
                            label="Median Property Value % Change"
                            fieldKey="median_property_value_change"
                            currentValue={initialData?.median_property_value_change || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <Input
                                type="number"
                                value={initialData?.median_property_value_change || ''}
                                onChange={(e) => onDataChange({ median_property_value_change: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pr-8"
                            />
                            <span className="absolute right-3 top-2 text-slate-400">%</span>
                        </div>
                    </div>
                        <div>
                            <DiscrepancyLabel
                                label="Violent Crime"
                                fieldKey="violent_crime"
                                currentValue={initialData?.violent_crime || ''}
                                pdfValues={pdfValues}
                            />
                            <Input
                                value={initialData?.violent_crime || ''}
                                onChange={(e) => onDataChange({ violent_crime: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                        <div>
                            <DiscrepancyLabel
                                label="Property Crime"
                                fieldKey="property_crime"
                                currentValue={initialData?.property_crime || ''}
                                pdfValues={pdfValues}
                            />
                            <Input
                                value={initialData?.property_crime || ''}
                                onChange={(e) => onDataChange({ property_crime: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                    <div>
                        <DiscrepancyLabel
                            label="2 BR Rent"
                            fieldKey="two_br_rent"
                            currentValue={initialData?.two_br_rent || ''}
                            pdfValues={pdfValues}
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400">$</span>
                            <Input
                                type="number"
                                value={initialData?.two_br_rent || ''}
                                onChange={(e) => onDataChange({ two_br_rent: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-7"
                            />
                        </div>
                    </div>
                        <div>
                            <DiscrepancyLabel
                                label="ELI Renter Households"
                                fieldKey="eli_renter_households"
                                currentValue={initialData?.eli_renter_households || ''}
                                pdfValues={pdfValues}
                            />
                            <Input
                                value={initialData?.eli_renter_households || ''}
                                onChange={(e) => onDataChange({ eli_renter_households: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                        <div>
                            <DiscrepancyLabel
                                label="Units per 100"
                                fieldKey="units_per_100"
                                currentValue={initialData?.units_per_100 || ''}
                                pdfValues={pdfValues}
                            />
                            <Input
                                value={initialData?.units_per_100 || ''}
                                onChange={(e) => onDataChange({ units_per_100: e.target.value })}
                                className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            />
                        </div>
                        <div>
                            <DiscrepancyLabel
                                label="Total Units"
                                fieldKey="total_units"
                                currentValue={initialData?.total_units || ''}
                                pdfValues={pdfValues}
                            />
                            <Input
                                value={initialData?.total_units || ''}
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

    return <GooglePlacesInput onDataChange={onDataChange} initialData={initialData} />;
};
