/**
 * UniversalSearchSelect
 * A production-grade, portal-based searchable select component.
 */

class UniversalSearchSelect {
    static portal = null;
    static activeInstance = null;

    constructor(element, options = {}) {
        this.select = typeof element === 'string' ? document.getElementById(element) : element;
        if (!this.select) return;
        if (this.select.getAttribute('data-native') === 'true' || this.select.closest('#root')) {
            return;
        }
        this.select._ussInstance = this;

        const firstOpt = this.select.options[0];
        const defaultPlaceholder = (firstOpt && !firstOpt.value) ? firstOpt.textContent.trim() : 'Select...';

        this.options = {
            placeholder: this.select.dataset.placeholder || defaultPlaceholder,
            allowCustom: this.select.dataset.allowCustom === 'true' || options.allowCustom || false,
            onSelect: options.onSelect || null,
            ...options
        };

        this.data = this._extractData();
        this.filteredData = [...this.data];
        this.isOpen = false;
        
        this._init();
    }

    _extractData() {
        return Array.from(this.select.options).map((opt, idx) => ({
            value: opt.value,
            text: opt.dataset.name || opt.textContent.trim(),
            category: opt.dataset.category || opt.dataset.subtext || '',
            isPlaceholder: idx === 0 && !opt.value && (
                opt.textContent.toLowerCase().includes('select') ||
                opt.textContent.toLowerCase().includes('choose') ||
                opt.textContent.toLowerCase().includes('add')
            )
        })).filter(opt => !opt.isPlaceholder);
    }

    _init() {
        // Remove any orphaned/prior sibling container first
        if (this.select.parentNode) {
            const existingSibling = this.select.parentNode.querySelector(':scope > .uss-container');
            if (existingSibling) {
                existingSibling.remove();
            }
        }

        // Create container and input
        this.container = document.createElement('div');
        this.container.className = 'uss-container';
        if (this.select.style.width) {
            this.container.style.width = this.select.style.width;
        }
        if (this.select.style.minWidth) {
            this.container.style.minWidth = this.select.style.minWidth;
        }
        if (this.select.style.flexShrink) {
            this.container.style.flexShrink = this.select.style.flexShrink;
        }
        
        this.inputWrapper = document.createElement('div');
        this.inputWrapper.className = 'uss-input-wrapper';
        
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'uss-input';
        this.input.placeholder = this.options.placeholder;
        this.input.setAttribute('autocomplete', 'off');
        this.input.setAttribute('spellcheck', 'false');
        this.input.readOnly = true; // Closed state is a read-only dropdown display
        
        if (this.select.disabled) {
            this.input.disabled = true;
            this.container.classList.add('disabled');
        }

        this.inputWrapper.appendChild(this.input);
        this.container.appendChild(this.inputWrapper);
        
        // Insert in DOM
        this.select.parentNode.insertBefore(this.container, this.select);
        this.select.style.display = 'none';

        // Set initial value
        const currentVal = this.select.value;
        if (currentVal) {
            const match = this.data.find(d => d.value === currentVal || d.text.toLowerCase() === currentVal.toLowerCase());
            if (match) {
                this.input.value = match.text;
            } else if (this.options.allowCustom) {
                this.input.value = currentVal;
            }
        }

        this._bindEvents();
    }

    _syncCustomValue(val) {
        const trimmed = (val || '').trim();
        const match = this.data.find(d => d.value.toLowerCase() === trimmed.toLowerCase() || d.text.toLowerCase() === trimmed.toLowerCase());
        if (match) {
            if (this.select.value !== match.value) {
                this.select.value = match.value;
                this.select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else {
            let customOpt = Array.from(this.select.options).find(o => o.dataset.custom === 'true');
            if (!customOpt) {
                customOpt = document.createElement('option');
                customOpt.dataset.custom = 'true';
                this.select.appendChild(customOpt);
            }
            customOpt.value = trimmed;
            customOpt.textContent = trimmed;
            this.select.value = trimmed;
            this.select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    _bindEvents() {
        // Clicking container or input when closed opens the dropdown
        this.container.addEventListener('click', (e) => {
            if (this.select.disabled) return;
            if (!this.isOpen) {
                this.open();
            }
        });

        this.input.addEventListener('focus', () => {
            if (this.select.disabled) return;
            if (!this.isOpen) {
                this.open();
            }
        });

        this.input.addEventListener('input', (e) => {
            if (!this.isOpen) return;
            const val = e.target.value;
            this.filter(val);
            if (this.options.allowCustom) {
                this._syncCustomValue(val);
            }
        });
        
        this.input.addEventListener('keydown', (e) => {
            if (this.select.disabled) return;

            // When closed: Space, Enter, or ArrowDown opens the dropdown
            if (!this.isOpen) {
                if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.open();
                    return;
                }
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
                return;
            }
            if (e.key === 'ArrowDown' && this.isOpen) {
                e.preventDefault();
                this._focusNext();
                return;
            }
            if (e.key === 'ArrowUp' && this.isOpen) {
                e.preventDefault();
                this._focusPrev();
                return;
            }
            if (e.key === 'Enter' && this.isOpen) {
                e.preventDefault();
                const activeItem = UniversalSearchSelect.portal.querySelector('.uss-item.hover') || UniversalSearchSelect.portal.querySelector('.uss-item');
                if (activeItem) {
                    this.selectItem(activeItem.dataset.value);
                } else {
                    this.close();
                }
                return;
            }
            if (e.key === 'Tab') {
                if (this.isOpen) {
                    this.close();
                }
            }
        });

        // Global listeners for positioning and closing
        if (!UniversalSearchSelect._globalListenersAttached) {
            document.addEventListener('click', (e) => {
                if (UniversalSearchSelect.activeInstance && 
                    !UniversalSearchSelect.activeInstance.container.contains(e.target) &&
                    !UniversalSearchSelect.portal.contains(e.target)) {
                    UniversalSearchSelect.activeInstance.close();
                }
            });

            window.addEventListener('scroll', () => {
                if (UniversalSearchSelect.activeInstance) {
                    UniversalSearchSelect.activeInstance._positionPortal();
                }
            }, true);

            let lastWidth = window.innerWidth;
            window.addEventListener('resize', () => {
                if (UniversalSearchSelect.activeInstance) {
                    // Only close on width change (mobile keyboard resizes height)
                    if (window.innerWidth !== lastWidth) {
                        UniversalSearchSelect.activeInstance.close();
                        lastWidth = window.innerWidth;
                    } else {
                        // Just reposition if height changed
                        UniversalSearchSelect.activeInstance._positionPortal();
                    }
                }
            });

            UniversalSearchSelect._globalListenersAttached = true;
        }

        // Programmatic change synchronization
        this.select.addEventListener('change', () => {
            const match = this.data.find(d => d.value === this.select.value);
            this.input.value = match ? match.text : '';
        });

        // Form reset synchronization
        this.form = this.select.closest('form');
        if (this.form) {
            this.form.addEventListener('reset', () => {
                setTimeout(() => {
                    const match = this.data.find(d => d.value === this.select.value);
                    this.input.value = match ? match.text : '';
                }, 10);
            });
        }
    }

    static _getPortal() {
        if (!UniversalSearchSelect.portal) {
            UniversalSearchSelect.portal = document.createElement('div');
            UniversalSearchSelect.portal.id = 'uss-portal';
            UniversalSearchSelect.portal.style.position = 'absolute';
            document.body.appendChild(UniversalSearchSelect.portal);
        }
        return UniversalSearchSelect.portal;
    }

    open() {
        if (this.select.disabled) return;
        if (UniversalSearchSelect.activeInstance && UniversalSearchSelect.activeInstance !== this) {
            UniversalSearchSelect.activeInstance.close();
        }

        UniversalSearchSelect.activeInstance = this;
        this.isOpen = true;
        this.container.classList.add('open');
        this.input.readOnly = false; // Enabled for search typing while open
        
        // Reset to display all options initially on click/focus
        this.filteredData = [...this.data];
        this._renderDropdown();
        this._positionPortal();
        
        const portal = UniversalSearchSelect._getPortal();
        portal.classList.add('active');

        // Select input text so user can immediately type to search
        setTimeout(() => {
            if (document.activeElement === this.input) {
                this.input.select();
            } else {
                this.input.focus();
                this.input.select();
            }
        }, 0);

        // Mobile UX: Scroll input into visible area if keyboard might hide it
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                this.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => this._positionPortal(), 300);
            }, 100);
        }
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.container.classList.remove('open');
        this.input.readOnly = true; // Lock back to readonly dropdown display!
        UniversalSearchSelect._getPortal().classList.remove('active');
        UniversalSearchSelect.activeInstance = null;
        
        const val = this.input.value.trim();
        if (this.options.allowCustom) {
            const match = this.data.find(d => d.value.toLowerCase() === val.toLowerCase() || d.text.toLowerCase() === val.toLowerCase());
            if (match) {
                this.input.value = match.text;
                if (this.select.value !== match.value) {
                    this.select.value = match.value;
                    this.select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (val) {
                this.input.value = val;
                this._syncCustomValue(val);
            } else {
                this.input.value = '';
                if (this.select.value !== '') {
                    this.select.value = '';
                    this.select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        } else {
            const match = this.data.find(d => d.value.toLowerCase() === val.toLowerCase() || d.text.toLowerCase() === val.toLowerCase());
            if (match) {
                this.input.value = match.text;
                if (this.select.value !== match.value) {
                    this.select.value = match.value;
                    this.select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (!val) {
                this.input.value = '';
                if (this.select.value !== '') {
                    this.select.value = '';
                    this.select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                // Revert to current selected item's text if no match
                const curMatch = this.data.find(d => d.value === this.select.value);
                this.input.value = curMatch ? curMatch.text : '';
            }
        }
    }

    static closeAll() {
        if (UniversalSearchSelect.activeInstance) {
            UniversalSearchSelect.activeInstance.close();
        }
    }

    filter(query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) {
            this.filteredData = [...this.data];
        } else {
            this.filteredData = this.data.filter(item => 
                item.text.toLowerCase().includes(q) ||
                (item.category && item.category.toLowerCase().includes(q))
            );
        }
        this._renderDropdown();
        this._positionPortal();
    }

    _renderDropdown() {
        const portal = UniversalSearchSelect._getPortal();
        const currentVal = this.select.value;

        if (this.filteredData.length === 0) {
            portal.innerHTML = '<div class="uss-no-results">No matches found</div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'uss-list';

        this.filteredData.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = `uss-item ${item.value === currentVal ? 'selected' : ''}`;
            div.dataset.value = item.value;
            if (item.category) {
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px;">
                        <span style="font-weight:500;">${item.text}</span>
                        <span class="badge" style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; color:#0C3925; background:rgba(12,57,37,0.08); border:1px solid rgba(12,57,37,0.15); flex-shrink:0;">${item.category}</span>
                    </div>
                `;
            } else {
                div.innerHTML = `<span>${item.text}</span>`;
            }
            
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectItem(item.value);
            });

            div.addEventListener('mouseenter', () => {
                portal.querySelectorAll('.uss-item').forEach(i => i.classList.remove('hover'));
                div.classList.add('hover');
            });

            list.appendChild(div);
        });

        portal.innerHTML = '';
        portal.appendChild(list);
    }

    _positionPortal() {
        const portal = UniversalSearchSelect._getPortal();
        const rect = this.input.getBoundingClientRect();
        const portalHeight = portal.offsetHeight || 250;
        const viewportHeight = window.innerHeight;
        
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Priority: Below (standard UX)
        // Only flip if space below is tiny (< 100px) AND space above is significantly larger
        const shouldFlip = spaceBelow < 150 && spaceAbove > spaceBelow;
        
        let top = 0;
        let left = rect.left + window.scrollX;
        if (rect.left + rect.width > window.innerWidth - 8) {
            left = Math.max(10, window.innerWidth - rect.width - 8) + window.scrollX;
        }
        left = Math.max(10, left);
        
        if (shouldFlip) {
            top = rect.top + window.scrollY - portalHeight - 4;
            portal.style.maxHeight = `${Math.min(300, spaceAbove - 20)}px`;
        } else {
            top = rect.bottom + window.scrollY + 4;
            portal.style.maxHeight = `${Math.min(300, spaceBelow - 20)}px`;
        }
        
        portal.style.width = `${rect.width}px`;
        portal.style.top = `${top}px`;
        portal.style.left = `${left}px`;
    }

    selectItem(value) {
        const item = this.data.find(d => d.value === value);
        if (item) {
            this.input.value = item.text;
            this.select.value = value;
            if (typeof this.select.onchange === 'function') {
                this.select.onchange({ target: this.select });
            }
            this.select.dispatchEvent(new Event('change', { bubbles: true }));
            if (this.options.onSelect) this.options.onSelect(value, item.text);
        } else if (this.options.allowCustom) {
            this.input.value = value;
            this._syncCustomValue(value);
        }
        this.close();
    }

    _focusNext() {
        const portal = UniversalSearchSelect._getPortal();
        const items = portal.querySelectorAll('.uss-item');
        const current = portal.querySelector('.uss-item.hover');
        let nextIndex = 0;

        if (current) {
            nextIndex = Array.from(items).indexOf(current) + 1;
            if (nextIndex >= items.length) nextIndex = 0;
            current.classList.remove('hover');
        }
        items[nextIndex].classList.add('hover');
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    }

    _focusPrev() {
        const portal = UniversalSearchSelect._getPortal();
        const items = portal.querySelectorAll('.uss-item');
        const current = portal.querySelector('.uss-item.hover');
        let nextIndex = items.length - 1;

        if (current) {
            nextIndex = Array.from(items).indexOf(current) - 1;
            if (nextIndex < 0) nextIndex = items.length - 1;
            current.classList.remove('hover');
        }
        items[nextIndex].classList.add('hover');
        items[nextIndex].scrollIntoView({ block: 'nearest' });
    }

    updateOptions() {
        this.data = this._extractData();
        this.filteredData = [...this.data];
        
        // Sync input text with select value in case it changed
        const match = this.data.find(d => d.value === this.select.value || d.text === this.select.value);
        if (match) {
            this.input.value = match.text;
        } else if (this.options.allowCustom && this.select.value) {
            this.input.value = this.select.value;
        } else {
            this.input.value = '';
        }

        if (this.select.disabled) {
            this.input.disabled = true;
            this.container.classList.add('disabled');
        } else {
            this.input.disabled = false;
            this.container.classList.remove('disabled');
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        if (this.select) {
            this.select.style.display = '';
            delete this.select._ussInstance;
            delete this.select.dataset.ussInitialized;
        }
    }

    static isSearchableSelect(select) {
        if (!select || select.getAttribute('data-native') === 'true' || select.closest('#root')) {
            return false;
        }

        // Explicit opt-in via data attribute or class
        if (select.dataset.searchable === 'true' || 
            select.dataset.autocomplete !== undefined ||
            select.hasAttribute('data-autocomplete') ||
            select.classList.contains('searchable-select') || 
            select.classList.contains('search-select')) {
            return true;
        }

        // Exclude pagination, table toolbars, filters, table row inline items, unit, and status selects
        const idLower = (select.id || '').toLowerCase();
        const nameLower = (select.name || '').toLowerCase();
        if (idLower.includes('unit') || nameLower.includes('unit') ||
            idLower.includes('status') || nameLower.includes('status') ||
            select.classList.contains('pagination-size-select') ||
            select.classList.contains('form-select-native') ||
            select.id.includes('filter') ||
            select.id.includes('pagination') ||
            select.id.includes('page-size') ||
            select.id === 'matrix-role-selector' ||
            select.id === 'rbac-role-select' ||
            select.closest('.production-items-table') ||
            select.closest('.table-toolbar') ||
            select.closest('.pagination')) {
            return false;
        }

        // Legitimate large entity fields that benefit from searchable dropdown
        const isEntityField = (!idLower.includes('unit') && !nameLower.includes('unit') && !idLower.includes('status') && !nameLower.includes('status')) &&
                              (idLower.includes('product') || nameLower.includes('product') ||
                               idLower.includes('client') || nameLower.includes('client') ||
                               idLower.includes('customer') || nameLower.includes('customer') ||
                               idLower.includes('supplier') || nameLower.includes('supplier') ||
                               idLower.includes('batch') || nameLower.includes('batch') ||
                               idLower.includes('sku') || nameLower.includes('sku') ||
                               idLower.includes('formula') || nameLower.includes('formula') ||
                               idLower.includes('warehouse') || nameLower.includes('warehouse') ||
                               idLower.includes('company') || nameLower.includes('company') ||
                               idLower.includes('material') || nameLower.includes('material'));

        // Only enhance if it's an entity field AND has more than 3 options
        if (isEntityField && select.options.length > 3) {
            return true;
        }

        return false;
    }

    // Static helper to initialize eligible searchable select elements
    static initAll() {
        document.querySelectorAll('select').forEach(select => {
            const shouldBeSearchable = UniversalSearchSelect.isSearchableSelect(select);

            if (!shouldBeSearchable) {
                // If previously upgraded, cleanly revert to native select
                if (select._ussInstance) {
                    select._ussInstance.destroy();
                }
                const siblingContainer = select.parentNode ? select.parentNode.querySelector(':scope > .uss-container') : null;
                if (siblingContainer) {
                    siblingContainer.parentNode.removeChild(siblingContainer);
                }
                select.style.display = '';
                if (!select.classList.contains('form-select') && !select.classList.contains('pagination-size-select')) {
                    select.classList.add('form-select');
                }
                return;
            }

            // Otherwise, enhance with UniversalSearchSelect
            if (!select.dataset.ussInitialized || !select._ussInstance) {
                new UniversalSearchSelect(select);
                select.dataset.ussInitialized = 'true';
            } else {
                const instance = select._ussInstance;
                if (instance) {
                    instance.updateOptions();
                }
            }
        });
    }
}

// Global hook for easy access
window.UniversalSearchSelect = UniversalSearchSelect;
