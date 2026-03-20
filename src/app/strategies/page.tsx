'use client';
import Header from '@/components/layout/Header';
import StrategyBuilder from '@/components/strategy/StrategyBuilder';
import StrategyList from '@/components/strategy/StrategyList';
import { useState } from 'react';
import { Plus, List } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'builder' | 'list';

export default function StrategiesPage() {
  const [tab, setTab] = useState<Tab>('builder');

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <Header title="AI Strategy Builder" />

      <div className="flex-1 overflow-hidden flex flex-col p-5 gap-5">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('builder')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'builder'
                ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <Plus className="w-4 h-4" />
            New Strategy
          </button>
          <button
            onClick={() => setTab('list')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === 'list'
                ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <List className="w-4 h-4" />
            My Strategies
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'builder' ? (
            <StrategyBuilder onCreated={() => setTab('list')} />
          ) : (
            <StrategyList onNew={() => setTab('builder')} />
          )}
        </div>
      </div>
    </main>
  );
}
