"use client";

import React, { useState } from 'react';
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from "use-places-autocomplete";
import { Input } from "@/components/ui/Input";

interface Step1Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

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
    const lastGeocodedAddressRef = React.useRef<string>('');

    React.useEffect(() => {
        if (typeof initialData?.name === 'string') {
            setProjectName(initialData.name);
        }
        if (typeof initialData?.address === 'string') {
            setValue(initialData.address, false);
        }
        if (initialData?.lat && initialData?.lng) {
            setCoordinates({ lat: initialData.lat, lng: initialData.lng });
        }
    }, [initialData?.name, initialData?.address, initialData?.lat, initialData?.lng, setValue]);

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

                const city = extractCityFromGeocode(results[0]) || extractCityFromAddressString(address);
                const county = extractCountyFromGeocode(results[0]);

                if (!initialData?.city && city) updates.city = city;
                if (!initialData?.county && county) updates.county = county;

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

    const handleSelect = async (address: string) => {
        setValue(address, false);
        clearSuggestions();

        try {
            const results = await getGeocode({ address });
            const { lat, lng } = await getLatLng(results[0]);
            setCoordinates({ lat, lng });
            const city = extractCityFromGeocode(results[0]) || extractCityFromAddressString(address);
            const county = extractCountyFromGeocode(results[0]);

            const payload: Record<string, any> = {
                name: projectName || address, // Use project name or fallback to address
                address,
                city,
                lat,
                lng,
                // Mock demographics for now
                population_1mile: 12500,
                median_income: 65000
            };

            if (county) {
                payload.county = county;
            }

            onDataChange(payload);
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
                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Project Name</label>
                <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Sunset RV Park"
                    className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Property Address</label>
                <div className="relative">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
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

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Population (1 mi)</label>
                    <Input disabled value={initialData?.population_1mile || ""} placeholder="Auto-fetched" className="bg-slate-100 dark:bg-[#1a2228]" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Median Income</label>
                    <Input disabled value={initialData?.median_income || ""} placeholder="Auto-fetched" className="bg-slate-100 dark:bg-[#1a2228]" />
                </div>
            </div>
        </div>
    );
};

export const Step1Location: React.FC<Step1Props> = ({ onDataChange, initialData }) => {
    const hasApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY.includes('placeholder');
    const [manualName, setManualName] = React.useState(initialData?.name || '');
    const [manualAddress, setManualAddress] = React.useState(initialData?.address || '');

    React.useEffect(() => {
        if (typeof initialData?.name === 'string') {
            setManualName(initialData.name);
        }
        if (typeof initialData?.address === 'string') {
            setManualAddress(initialData.address);
        }
    }, [initialData?.name, initialData?.address]);

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
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Project Name</label>
                    <Input
                        value={manualName}
                        onChange={e => {
                            setManualName(e.target.value);
                            onDataChange({
                                name: e.target.value,
                                address: manualAddress,
                                city: extractCityFromAddressString(manualAddress),
                            });
                        }}
                        placeholder="e.g., Sunset RV Park"
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Manual Property Address</label>
                    <Input
                        value={manualAddress}
                        onChange={e => {
                            setManualAddress(e.target.value);
                            onDataChange({
                                name: manualName,
                                address: e.target.value,
                                city: extractCityFromAddressString(e.target.value),
                            });
                        }}
                        onBlur={e =>
                            onDataChange({
                                name: manualName,
                                address: e.target.value,
                                city: extractCityFromAddressString(e.target.value),
                            })
                        } // Ensure save on blur for manual entry
                        placeholder="Enter address manually..."
                        className="w-full bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent text-slate-900 dark:text-white"
                    />
                </div>
            </div>
        );
    }

    return <GooglePlacesInput onDataChange={onDataChange} initialData={initialData} />;
};
