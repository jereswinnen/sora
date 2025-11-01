"use client";

import { useState } from "react";
import { CaseSensitiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignLeftIcon, AlignCenterIcon } from "lucide-react";

export type AppearanceSettings = {
  theme: "sans" | "serif";
  titleSize: number;
  titleLeading: number;
  titleAlignment: "left" | "center";
  bodySize: number;
  bodyLeading: number;
  margins: "narrow" | "normal" | "wide";
  justifyText: boolean;
};

interface AppearancePopoverProps {
  settings: AppearanceSettings;
  onSettingsChange: (settings: AppearanceSettings) => void;
}

export function AppearancePopover({
  settings,
  onSettingsChange,
}: AppearancePopoverProps) {
  const [open, setOpen] = useState(false);

  const updateSetting = <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K],
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Appearance Settings">
          <CaseSensitiveIcon />
          Appearance
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Theme Section */}
          <div className="space-y-2">
            <Label>Theme</Label>
            <RadioGroup
              value={settings.theme}
              onValueChange={(value) =>
                updateSetting("theme", value as "sans" | "serif")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sans" id="theme-sans" />
                <Label
                  htmlFor="theme-sans"
                  className="font-normal cursor-pointer"
                >
                  Sans
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="serif" id="theme-serif" />
                <Label
                  htmlFor="theme-serif"
                  className="font-normal cursor-pointer"
                >
                  Serif
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Size Section */}
          <div className="space-y-3">
            <Label>Size</Label>

            <FieldGroup>
              <Field>
                <FieldLabel>Title Size (px)</FieldLabel>
                <Input
                  type="number"
                  min="24"
                  max="64"
                  value={settings.titleSize}
                  onChange={(e) =>
                    updateSetting("titleSize", Number(e.target.value))
                  }
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Title Leading</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  max="2"
                  step="0.1"
                  value={settings.titleLeading}
                  onChange={(e) =>
                    updateSetting("titleLeading", Number(e.target.value))
                  }
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Title Alignment</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={settings.titleAlignment}
                  onValueChange={(value) =>
                    value &&
                    updateSetting("titleAlignment", value as "left" | "center")
                  }
                >
                  <ToggleGroupItem value="left" aria-label="Align left">
                    <AlignLeftIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="center" aria-label="Align center">
                    <AlignCenterIcon />
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Body Size (px)</FieldLabel>
                <Input
                  type="number"
                  min="14"
                  max="28"
                  value={settings.bodySize}
                  onChange={(e) =>
                    updateSetting("bodySize", Number(e.target.value))
                  }
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Body Leading</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={settings.bodyLeading}
                  onChange={(e) =>
                    updateSetting("bodyLeading", Number(e.target.value))
                  }
                />
              </Field>
            </FieldGroup>
          </div>

          <Separator />

          {/* General Section */}
          <div className="space-y-3">
            <Label>General</Label>

            <FieldGroup>
              <Field>
                <FieldLabel>Margins</FieldLabel>
                <RadioGroup
                  value={settings.margins}
                  onValueChange={(value) =>
                    updateSetting(
                      "margins",
                      value as "narrow" | "normal" | "wide",
                    )
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="narrow" id="margins-narrow" />
                    <Label
                      htmlFor="margins-narrow"
                      className="font-normal cursor-pointer"
                    >
                      Narrow
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="margins-normal" />
                    <Label
                      htmlFor="margins-normal"
                      className="font-normal cursor-pointer"
                    >
                      Normal
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wide" id="margins-wide" />
                    <Label
                      htmlFor="margins-wide"
                      className="font-normal cursor-pointer"
                    >
                      Wide
                    </Label>
                  </div>
                </RadioGroup>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="justify-text">Justify Text</FieldLabel>
                  <Switch
                    id="justify-text"
                    checked={settings.justifyText}
                    onCheckedChange={(checked) =>
                      updateSetting("justifyText", checked)
                    }
                  />
                </div>
              </Field>
            </FieldGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
