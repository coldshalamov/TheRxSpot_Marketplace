'use client'  
  
export default function TenantErrorBoundary({  
  error,  
  reset,  
}: {  
  error: Error & { digest?: string }  
  reset: () => void  
}) {  
  return (  
    <div className="min-h-screen flex items-center justify-center bg-gray-50">  
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">  
        <div className="text-red-500 mb-4">  
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">  
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />  
          </svg>  
        </div>  
        <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>  
        <p className="text-gray-600 mb-6">We couldn't load this pharmacy's storefront.</p>  
        <button  
          onClick={reset}  
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"  
        >  
          Try again  
        </button>  
      </div>  
    </div>  
  )  
} 
