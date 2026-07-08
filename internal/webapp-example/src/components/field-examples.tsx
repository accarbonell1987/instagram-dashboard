'use client';

import {
  Button,
  ButtonGroup,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Input,
  RadioGroup,
  RadioGroupItem,
  Slider,
  Switch,
} from '@core/ui';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Example } from '@/components/example';

export function FieldExamples() {
  const [gpuCount, setGpuCount] = useState(8);
  const [value, setValue] = useState([200, 800]);

  const handleGpuAdjustment = useCallback((adjustment: number) => {
    setGpuCount((prevCount) => Math.max(1, Math.min(99, prevCount + adjustment)));
  }, []);

  const handleGpuInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 99) {
      setGpuCount(value);
    }
  }, []);

  return (
    <Example title="Form Fields">
      <FieldSet className="w-full max-w-md">
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Compute Environment</FieldLegend>
            <FieldDescription>Select the compute environment for your cluster.</FieldDescription>
            <RadioGroup defaultValue="kubernetes">
              <FieldLabel htmlFor="kubernetes">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Kubernetes</FieldTitle>
                    <FieldDescription>
                      Run GPU workloads on a K8s configured cluster.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="kubernetes" id="kubernetes" aria-label="Kubernetes" />
                </Field>
              </FieldLabel>
              <FieldLabel htmlFor="vm">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Virtual Machine</FieldTitle>
                    <FieldDescription>
                      Access a VM configured cluster. (Coming soon)
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="vm" id="vm" aria-label="Virtual Machine" />
                </Field>
              </FieldLabel>
            </RadioGroup>
          </FieldSet>

          <FieldSeparator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="number-of-gpus">Number of GPUs</FieldLabel>
              <FieldDescription>You can add more later.</FieldDescription>
            </FieldContent>
            <ButtonGroup>
              <Input
                id="number-of-gpus"
                value={gpuCount}
                onChange={handleGpuInputChange}
                className="w-16 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => {
                  handleGpuAdjustment(-1);
                }}
                disabled={gpuCount <= 1}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => {
                  handleGpuAdjustment(1);
                }}
                disabled={gpuCount >= 99}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </ButtonGroup>
          </Field>

          <FieldSeparator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="tinting">Wallpaper Tinting</FieldLabel>
              <FieldDescription>Allow the wallpaper to be tinted.</FieldDescription>
            </FieldContent>
            <Switch id="tinting" defaultChecked />
          </Field>

          <FieldSeparator />

          <Field>
            <FieldTitle>Price Range</FieldTitle>
            <FieldDescription>
              Set your budget range (${value[0]} - ${value[1]}).
            </FieldDescription>
            <Slider
              value={value}
              onValueChange={(val) => {
                setValue(val);
              }}
              max={1000}
              min={0}
              step={10}
              className="mt-2 w-full"
            />
          </Field>
        </FieldGroup>
      </FieldSet>
    </Example>
  );
}
