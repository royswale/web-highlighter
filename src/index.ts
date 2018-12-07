import * as EventEmitter from 'eventemitter3';
import {EventType, HighlighterOptions, ERROR} from './types';
import {DEFAULT_OPTIONS, CAMEL_DATASET_IDENTIFIER} from './util/const';
import {isHighlightWrapNode, getHighlightDomById, getDomPosition, getAllHighlightDom} from './util/dom';
import HighlightRange from './model/range';
import HighlightSource from './model/source';
import Cache from './data/cache';
import Paint from './paint';
import Store from './addons/store/local.store';

const schemeValidate = obj => {
    if (!obj.startMeta) {
        return false;
    }
    if (!obj.endMeta) {
        return false;
    }
    if (!obj.text) {
        return false;
    }
    if (!obj.id) {
        return false;
    }
    return true;
};

export default class Highlighter extends EventEmitter {
    static event = EventType;
    static LocalStore = Store;
    static buildFromJSON(obj: HighlightSource) {
        if (schemeValidate(obj)) {
            return null;
        }

        const source = new HighlightSource(
            obj.startMeta,
            obj.endMeta,
            obj.text,
            obj.id
        );
        return source;
    }

    options: HighlighterOptions;
    paint: Paint;
    cache: Cache;
    private _hoverId: string;

    constructor(options: HighlighterOptions) {
        super();
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
        this.paint = new Paint({
            $root: this.options.$root,
            highlightClassName: this.options.style.highlightClassName,
            exceptSelectors: this.options.exceptSelectors
        });
        this.cache = new Cache(this.options.useLocalStore);
        this.options.$root.addEventListener('mouseover', this._handleHighlightHover);
    }

    /*================= you should not use it outside =================*/
    private _highlighFromRange = (range: HighlightRange): HighlightSource => {
        const source: HighlightSource = range.serialize();
        const $wraps = this.paint.highlightRange(range);

        if ($wraps.length === 0) {
            console.warn(ERROR.DOM_SELECTION_EMPTY);
            return null;
        }
        this.cache.save(source);
        this.emit(EventType.CREATE, {sources: [source]});
        return source;
    }

    private _handleSelection = (e?: Event) => {
        const range = HighlightRange.fromSelection();
        if (!range) {
            return;
        }
        this._highlighFromRange(range);
        HighlightRange.removeDomRange();
    }

    private _handleHighlightHover = e => {
        const $target = e.target as HTMLElement;
        if (!isHighlightWrapNode($target)) {
            // leave highlight
            if (this._hoverId) {
                this.emit(EventType.HOVER_OUT, {id: this._hoverId});
            }

            this._hoverId = null;
            return;
        }

        const id = $target.dataset ? $target.dataset[CAMEL_DATASET_IDENTIFIER] : undefined;
        // prevent triggering hover in the same highlight
        if (this._hoverId === id) {
            return;
        }
        // move to a continuous wrap, trigger hover out firstly
        if (this._hoverId) {
            this.emit(EventType.HOVER_OUT, {id: this._hoverId});
        }

        this._hoverId = id;
        this.emit(EventType.HOVER, {id: this._hoverId});
    }
    /*================= you should not use it outside =================*/

    init(sources: HighlightSource[] = []) {
        sources.forEach(s => {
            if (s instanceof HighlightSource) {
                this.paint.highlightSource(s);
                return;
            }
            console.error(ERROR.SOURCE_TYPE_ERROR);
        });
        this.cache.save(sources);
        this.emit(EventType.INIT, {sources});
        return this;
    }

    render(sources: HighlightSource[] | HighlightSource) {
        const list = Array.isArray(sources)
            ? sources as HighlightSource[]
            : [sources as HighlightSource];

        list.forEach(s => this.paint.highlightSource(s));
        this.emit(EventType.CREATE, {sources});
        return this;
    }

    remove(id: string) {
        if (!id) {
            return;
        }
        this.paint.removeHighlight(id);
        this.cache.remove(id);
        this.emit(EventType.REMOVE, {ids: [id]});
        return this;
    }

    removeAll() {
        this.paint.removeAllHighlight();
        const ids = this.cache.removeAll();
        this.emit(EventType.REMOVE, {ids: ids});
    }

    run = (): Highlighter => {
        this.options.$root.addEventListener('mouseup', this._handleSelection);
        return this;
    }
    stop = (): Highlighter => {
        this.options.$root.removeEventListener('mouseup', this._handleSelection);
        return this;
    }

    dispose = (): Highlighter => {
        this.options.$root.removeEventListener('mouseover', this._handleHighlightHover);
        return this;
    }

    getDoms = (id?: string): Array<HTMLElement> => {
        return id ? getHighlightDomById(this.options.$root, id) : getAllHighlightDom(this.options.$root);
    }

    addClass = (className: string, id?: string): Highlighter => {
        this.getDoms(id).forEach($n => $n.classList.add(className));
        return this;
    }

    removeClass = (className: string, id?: string): Highlighter => {
        this.getDoms(id).forEach($n => $n.classList.remove(className));
        return this;
    }

    getHighlightPosition = (id: string) => {
        const $wraps = this.getDoms(id);
        const startPosition = getDomPosition($wraps[0]);
        const endPosition = getDomPosition($wraps[$wraps.length - 1]);
        const height = $wraps[$wraps.length - 1].offsetHeight;
        const width = $wraps[$wraps.length - 1].offsetWidth;

        return {
            start: {top: startPosition.top, left: startPosition.left},
            end: {top: endPosition.top + height, left: endPosition.left + width}
        };
    }

    highlight = (range: Range): HighlightSource => {
        const hRange = new HighlightRange(
            range.startContainer,
            range.endContainer,
            range.startOffset,
            range.endOffset,
            range.toString()
        );
        if (!hRange) {
            console.warn(ERROR.RANGE_INVALID);
            return null;
        }
        return this._highlighFromRange(hRange);
    }
}
