import { useEffect, useRef, useState } from 'react';
import { Quote } from 'lucide-react';

const hitokotoQuotes = [
  '生活就像骑自行车，想保持平衡就得往前走。',
  '每天进步一点点，就是最好的捷径。',
  '把复杂的事情简单化，你就赢了。',
  '种一棵树最好的时间是十年前，其次是现在。',
  '世界上唯一不变的就是变化本身。',
  '不积跬步，无以至千里。',
  '你不需要很厉害才能开始，但你需要开始才能很厉害。',
  '所谓无底深渊，下去也是前程万里。',
  '万物皆有裂痕，那是光照进来的地方。',
  '做你自己，因为别人都有人做了。',
  '与其担心未来，不如现在好好努力。',
  '最好的投资就是投资自己。',
  '所有的大人都曾经是小孩，虽然只有少数人记得。',
  '当你觉得晚了的时候，恰恰是最早的时候。',
  '保持热爱，奔赴山海。',
];

export function Hitokoto() {
  const [quote, setQuote] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    function next() {
      indexRef.current = (indexRef.current + 1) % hitokotoQuotes.length;
      setQuote(hitokotoQuotes[indexRef.current]);
    }
    next();
    const timer = setInterval(next, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground" title="一言">
      <Quote className="h-3 w-3 shrink-0 opacity-50" />
      <span className="truncate">{quote}</span>
    </p>
  );
}
