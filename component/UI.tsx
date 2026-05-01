'use client'

interface PlanCardProps {
  planName: string
  displayName: string
  price: number
  months: number
  isPopular?: boolean
  isBestValue?: boolean
  enabled: boolean
  isSelected: boolean
  onSelect: () => void
}

export function PlanCard({
  displayName,
  price,
  isPopular,
  isBestValue,
  isSelected,
  onSelect
}: PlanCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl p-4 border-2 transition-all text-left ${
        isSelected 
          ? 'border-blue-600 bg-blue-50' 
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
              {displayName}
            </p>
            {isPopular && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Popular
              </span>
            )}
            {isBestValue && (
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Best Value
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Full access for the duration</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-900">₦{price.toLocaleString()}</p>
        </div>
      </div>
    </button>
  )
}
