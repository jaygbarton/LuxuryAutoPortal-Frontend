import {useEffect,useState} from 'react';
import {addUtcDays,dayKeyToUtcDate,mtDayStartToUtcIso,mtTodayKey,utcDateToDayKey} from '@/lib/mt-datetime';
/** One daily rollover, with a local date check when returning from a sleeping tab. */
export function useFeaturedRankingDay() {
  const [day,setDay]=useState(()=>mtTodayKey());
  useEffect(()=>{
    const check=()=>setDay(mtTodayKey());
    const tomorrow=utcDateToDayKey(addUtcDays(dayKeyToUtcDate(day),1));
    const boundary=new Date(mtDayStartToUtcIso(tomorrow)!).getTime();
    const timer=window.setTimeout(check,Math.max(1,boundary-Date.now()));
    const visible=()=>{if(document.visibilityState==='visible')check();};
    window.addEventListener('focus',check);document.addEventListener('visibilitychange',visible);
    return()=>{clearTimeout(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',visible);};
  },[day]);
  return day;
}
