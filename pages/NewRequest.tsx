import React, { useState, useEffect } from 'react';
import { getServices, seedInitialServices } from '../services/firebaseService';
import { ServiceDefinition } from '../types';
import Spinner from '../components/Spinner';
import { Link } from 'react-router-dom';

const ServiceCard: React.FC<{ service: ServiceDefinition }> = ({ service }) => {
  return (
    <Link 
      to={`/request-form/${service.id}`}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center text-center"
    >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-indigo-100 dark:bg-indigo-900`}>
            <span className="text-3xl">{service.icon}</span>
        </div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{service.title}</h3>
    </Link>
  );
};


const NewRequest: React.FC = () => {
    const [services, setServices] = useState<ServiceDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchServices = async () => {
            setLoading(true);
            try {
                const availableServices = await getServices();
                setServices(availableServices);
            } catch (error) {
                console.error("Error fetching services:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchServices();
    }, []);

    const handleSeed = async () => {
        setLoading(true);
        try {
            await seedInitialServices();
            const availableServices = await getServices();
            setServices(availableServices);
        } catch (error) {
            console.error("Error seeding services:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">إنشاء طلب جديد</h1>
                <p className="mt-1 text-gray-500 dark:text-gray-400">اختر نوع الخدمة التي ترغب في طلبها.</p>
            </div>
            
            {loading ? (
                <div className="flex justify-center"><Spinner /></div>
            ) : services.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {services.map(service => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl flex flex-col items-center justify-center">
                    <div className="mb-4 text-gray-400">
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">لا توجد خدمات متاحة</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                        يبدو أن قاعدة البيانات فارغة. يمكنك إضافة خدمات افتراضية للبدء في استخدام النظام.
                    </p>
                    <button 
                        onClick={handleSeed}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        تهيئة النظام بالخدمات الافتراضية
                    </button>
                </div>
            )}
        </div>
    );
};

export default NewRequest;