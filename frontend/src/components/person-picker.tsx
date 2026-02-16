'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface Person {
  id: string;
  name: string;
  position?: string;
  department?: string;
  profession?: string;
  image?: string; // Optional: URL ของรูปโปรไฟล์
}

interface PersonPickerProps {
  persons: Person[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PersonPicker({
  persons,
  value,
  onChange,
  placeholder = 'เลือกบุคลากร',
  disabled = false,
}: PersonPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const selectedPerson = React.useMemo(() => persons.find((p) => p.id === value), [persons, value]);

  // Filter persons (Manual filtering allows searching across multiple fields)
  const filteredPersons = React.useMemo(() => {
    if (!searchQuery) return persons;
    const lowerQuery = searchQuery.toLowerCase();
    return persons.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.department?.toLowerCase().includes(lowerQuery) ||
        p.position?.toLowerCase().includes(lowerQuery) ||
        p.profession?.toLowerCase().includes(lowerQuery),
    );
  }, [persons, searchQuery]);

  // Group by department
  const groupedPersons = React.useMemo(() => {
    const groups: Record<string, Person[]> = {};
    filteredPersons.forEach((p) => {
      const dept = p.department || 'อื่นๆ';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(p);
    });
    return groups;
  }, [filteredPersons]);

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between h-auto py-2 px-3 bg-background hover:bg-accent/50 border-input',
            !value && 'text-muted-foreground',
          )}
        >
          {selectedPerson ? (
            <div className="flex items-center gap-3 text-left overflow-hidden">
              <Avatar className="h-8 w-8 border shrink-0">
                <AvatarImage src={selectedPerson.image} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                  {getInitials(selectedPerson.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm leading-none truncate">
                  {selectedPerson.name}
                </span>
                <span className="text-xs text-muted-foreground mt-1 truncate">
                  {selectedPerson.position || selectedPerson.department || '-'}
                </span>
              </div>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 opacity-50" />
              </div>
              <span>{placeholder}</span>
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false} className="max-h-[400px]">
          <CommandInput
            placeholder="ค้นหาชื่อ, ตำแหน่ง, หรือหน่วยงาน..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              ไม่พบบุคลากรที่ค้นหา
            </CommandEmpty>

            {value && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="text-muted-foreground justify-center text-xs h-8"
                >
                  <X className="mr-2 h-3 w-3" /> ล้างการเลือก
                </CommandItem>
              </CommandGroup>
            )}

            {Object.entries(groupedPersons).map(([dept, deptPersons]) => (
              <React.Fragment key={dept}>
                <CommandGroup heading={dept}>
                  {deptPersons.map((person) => (
                    <CommandItem
                      key={person.id}
                      value={person.id}
                      onSelect={() => {
                        onChange(person.id);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between py-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="h-8 w-8 shrink-0 border">
                          <AvatarImage src={person.image} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{person.name}</span>
                            {person.profession && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1 text-[9px] font-normal text-muted-foreground shrink-0"
                              >
                                {person.profession}
                              </Badge>
                            )}
                          </div>
                          <span
                            className="text-xs text-muted-foreground truncate"
                            title={person.position}
                          >
                            {person.position || '-'}
                          </span>
                        </div>
                      </div>
                      {value === person.id && (
                        <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </React.Fragment>
            ))}
          </CommandList>
          <div className="border-t p-2 text-[10px] text-center text-muted-foreground bg-muted/20">
            แสดง {filteredPersons.length} จาก {persons.length} รายชื่อ
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
