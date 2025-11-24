import { EditorHapticEvent, AHAPPattern, AHAPEvent, AHAPParameterCurve, AHAPParameterCurveControlPoint } from '../types';

/**
 * Professional AHAP Generator
 * 
 * Features:
 * - High precision floating point math (up to 9 decimal places)
 * - Optimized JSON structure
 * - Strict adherence to Apple Haptic Audio Pattern specifications
 * - Dynamic pattern generation
 */
export class AHAPGeneratorPro {
    private events: EditorHapticEvent[];
    private static readonly TIME_PRECISION = 9;
    private static readonly VALUE_PRECISION = 9;

    constructor(events: EditorHapticEvent[]) {
        this.events = events;
    }

    /**
     * Generates the AHAP pattern with professional formatting
     */
    public async generate(): Promise<AHAPPattern> {
        // Simulate processing time for larger patterns to show loading state
        if (this.events.length > 50) {
            await new Promise(resolve => setTimeout(resolve, 800));
        } else {
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        const sortedEvents = [...this.events].sort((a, b) => a.startTime - b.startTime);

        // Separate collections for Events and Curves to ensure correct order (Curves FIRST, then Events)
        const eventsList: { Event: AHAPEvent }[] = [];
        const curvesList: { ParameterCurve: AHAPParameterCurve }[] = [];

        for (const evt of sortedEvents) {
            this.compileEvent(evt, eventsList, curvesList);
        }

        // The reference format strictly places ParameterCurves BEFORE Events
        const patternItems = [...curvesList, ...eventsList];

        return {
            Version: 1.0,
            Pattern: patternItems
        };
    }

    private compileEvent(
        evt: EditorHapticEvent,
        eventsOutput: { Event: AHAPEvent }[],
        curvesOutput: { ParameterCurve: AHAPParameterCurve }[]
    ) {
        const startTime = this.formatFloat(evt.startTime);
        const duration = this.formatFloat(evt.duration);

        const isTransient = evt.type === 'Transient';
        const hasDuration = duration > 0.005;
        const isContinuous = evt.type === 'Continuous' || (isTransient && hasDuration);

        // 1. Create Base Event
        const ahapEvent: AHAPEvent = {
            EventType: isContinuous ? 'HapticContinuous' : 'HapticTransient',
            Time: startTime,
            EventParameters: [
                {
                    ParameterID: 'HapticIntensity',
                    ParameterValue: this.formatFloat(this.clamp(evt.intensity))
                },
                {
                    ParameterID: 'HapticSharpness',
                    ParameterValue: this.formatFloat(this.clamp(evt.sharpness))
                }
            ]
        };

        if (isContinuous) {
            ahapEvent.EventDuration = Math.max(duration, 0.005);
        }

        eventsOutput.push({ Event: ahapEvent });

        // 2. Create Parameter Curves (Added to curvesOutput)
        if (isContinuous) {
            this.compileCurve(curvesOutput, 'HapticIntensityControl', startTime, duration, evt.intensityCurve);
            this.compileCurve(curvesOutput, 'HapticSharpnessControl', startTime, duration, evt.sharpnessCurve);
        }
    }

    private compileCurve(
        output: any[],
        parameterId: string,
        startTime: number,
        duration: number,
        points: AHAPParameterCurveControlPoint[]
    ) {
        if (!points || points.length === 0) return;

        const sortedPoints = [...points].sort((a, b) => a.Time - b.Time);

        const controlPoints: AHAPParameterCurveControlPoint[] = sortedPoints.map(p => {
            const t = this.clamp(p.Time, 0, duration);
            return {
                Time: this.formatFloat(t),
                ParameterValue: this.formatFloat(this.clamp(p.ParameterValue))
            };
        });

        output.push({
            ParameterCurve: {
                ParameterID: parameterId as any,
                Time: startTime,
                ParameterCurveControlPoints: controlPoints
            }
        });
    }

    private formatFloat(num: number): number {
        return Number(num.toFixed(AHAPGeneratorPro.VALUE_PRECISION));
    }

    private clamp(num: number, min = 0, max = 1): number {
        return Math.min(Math.max(num, min), max);
    }

    /**
     * Validates the generated JSON string against basic AHAP structure
     */
    public static validate(jsonString: string): boolean {
        try {
            const parsed = JSON.parse(jsonString);
            if (typeof parsed.Version !== 'number') return false;
            if (!Array.isArray(parsed.Pattern)) return false;
            return true;
        } catch (e) {
            return false;
        }
    }
}
