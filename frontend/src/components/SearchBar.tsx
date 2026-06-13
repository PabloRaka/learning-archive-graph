import React from 'react';
import { Search, Plus, Filter, Tag, BookOpen } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showCategories: boolean;
  setShowCategories: (val: boolean) => void;
  showLearnings: boolean;
  setShowLearnings: (val: boolean) => void;
  onAddLearning: () => void;
  onAddCategory: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  showCategories,
  setShowCategories,
  showLearnings,
  setShowLearnings,
  onAddLearning,
  onAddCategory,
}) => {
  return (
    <div className="w-full angular-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative">
      <div className="corner-square top-0 left-0" />
      
      {/* Search Input */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone" />
        <input
          type="text"
          placeholder="Search"
          className="w-full tech-input pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Toggles */}
      <div className="flex items-center gap-3">
        <span className="text-mute flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" /> Filter nodes:
        </span>
        
        <button
          onClick={() => setShowCategories(!showCategories)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase border rounded-[2px] transition-all cursor-pointer ${
            showCategories
              ? 'bg-ink text-canvas border-ink'
              : 'border-hairline text-body hover:border-brand'
          }`}
        >
          <Tag className="h-3 w-3" /> Categories
        </button>

        <button
          onClick={() => setShowLearnings(!showLearnings)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase border rounded-[2px] transition-all cursor-pointer ${
            showLearnings
              ? 'bg-ink text-canvas border-ink'
              : 'border-hairline text-body hover:border-brand'
          }`}
        >
          <BookOpen className="h-3 w-3" /> Learnings
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAddCategory}
          className="btn-outline-secondary py-2 text-xs font-bold uppercase cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Category
        </button>
        <button
          onClick={onAddLearning}
          className="btn-primary py-2 text-xs font-bold uppercase cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Add Learning
        </button>
      </div>
    </div>
  );
};
