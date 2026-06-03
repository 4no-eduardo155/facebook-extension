function getListingIndex() {
    try {
        const url = new URL(window.location.href);
        const index = parseInt(url.searchParams.get('autofillIndex') || '0', 10);
        return Number.isFinite(index) && index >= 0 ? index : 0;
    } catch (e) {
        return 0;
    }
}

function pickListingData(data) {
    const index = getListingIndex();
    const listings = Array.isArray(data.listings) ? data.listings : [];
    const listing = listings[index] || listings[0] || {
        title: data.title || '',
        price: data.price || '',
        description: data.description || '',
        imageDataList: data.imageDataList || []
    };
    listing.__index = index;
    return listing;
}

function getCopyTabIndex() {
    try {
        const url = new URL(window.location.href);
        const copy = parseInt(url.searchParams.get('copyTab') || '', 10);
        if (Number.isFinite(copy) && copy >= 0) return copy;
    } catch (e) {}
    return getListingIndex();
}

function pickLocation(stored, listingIndex) {
    const locations = Array.isArray(stored.locations) ? stored.locations : [];
    if (!locations.length) return '';
    
    // FIXED: Improved location mapping logic for multi-listing + multi-tab scenarios
    // If single listing with multiple tabs (copyTab param present), use copyTab as location index
    const copyTabParam = new URL(window.location.href).searchParams.get('copyTab');
    if (copyTabParam !== null) {
        const copyTabIndex = parseInt(copyTabParam, 10);
        if (Number.isFinite(copyTabIndex) && copyTabIndex >= 0) {
            return locations[copyTabIndex] || locations[locations.length - 1] || '';
        }
    }
    
    // Otherwise, use listing index
    return locations[listingIndex] || locations[locations.length - 1] || '';
}

function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function findLocationInput() {
    const exactInputs = Array.from(document.querySelectorAll("input[aria-label='Location'], input[placeholder*='Location' i]"));
    const exact = exactInputs.find(inp => isVisible(inp) && !isFacebookTopSearch(inp));
    if (exact) return exact;

    const inputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])"));
    return inputs.find(inp => {
        if (!isVisible(inp) || isFacebookTopSearch(inp)) return false;
        const label = (inp.getAttribute('aria-label') || inp.getAttribute('placeholder') || '').toLowerCase();
        if (label.includes('search facebook') || label === 'search') return false;
        if (label.includes('price') || label.includes('title') || label.includes('sku') || label.includes('tags')) return false;
        return label.includes('location') || label.includes('city') || label.includes('zip');
    }) || null;
}

function isFacebookTopSearch(inp) {
    const aria = (inp.getAttribute('aria-label') || inp.getAttribute('placeholder') || '').toLowerCase();
    const rect = inp.getBoundingClientRect();
    return aria.includes('search facebook') || (aria.includes('search') && rect.top < 90);
}

function getTextNodesWith(text) {
    const xp = `//*[self::span or self::div or self::label][normalize-space(text())='${text}']`;
    const res = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const nodes = [];
    for (let i = 0; i < res.snapshotLength; i++) {
        const el = res.snapshotItem(i);
        if (isVisible(el)) nodes.push(el);
    }
    return nodes;
}

function findLocationCard() {
    const labels = getTextNodesWith('Location');
    for (const label of labels) {
        const rect = label.getBoundingClientRect();
        if (rect.top < 70) continue;
        let el = label;
        for (let i = 0; i < 10 && el; i++, el = el.parentElement) {
            const role = el.getAttribute && el.getAttribute('role');
            const tabIndex = el.getAttribute && el.getAttribute('tabindex');
            const r = el.getBoundingClientRect();
            const looksClickable = role === 'button' || role === 'combobox' || tabIndex === '0' || el.onclick;
            if (looksClickable && r.width > 120 && r.height > 25) return el;
        }
        let card = label;
        for (let i = 0; i < 5 && card.parentElement; i++) card = card.parentElement;
        if (card && isVisible(card)) return card;
    }
    return null;
}

function scrollFormDown() {
    const scrollables = Array.from(document.querySelectorAll('div')).filter(el => {
        const st = window.getComputedStyle(el);
        return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 100;
    });
    if (scrollables.length) {
        scrollables.sort((a,b) => b.scrollHeight - a.scrollHeight);
        scrollables[0].scrollTop = Math.min(scrollables[0].scrollTop + 900, scrollables[0].scrollHeight);
    }
    window.scrollBy({top: 700, behavior: 'smooth'});
}

function normalizeText(txt) {
    return (txt || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function clickLikeHuman(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const x = Math.max(5, Math.min(window.innerWidth - 5, r.left + Math.min(80, r.width / 2)));
    const y = Math.max(5, Math.min(window.innerHeight - 5, r.top + r.height / 2));
    const target = document.elementFromPoint(x, y) || el;
    ['pointerover','mouseover','pointermove','mousemove','pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => {
        const ev = type.startsWith('pointer')
            ? new PointerEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true })
            : new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y });
        target.dispatchEvent(ev);
    });
    return true;
}

function getClickableSuggestionRow(el) {
    let cur = el;
    for (let i = 0; i < 9 && cur; i++, cur = cur.parentElement) {
        const r = cur.getBoundingClientRect();
        const txt = normalizeText(cur.innerText || cur.textContent || '');
        if (r.width >= 180 && r.height >= 35 && r.left < 420 && txt.length > 2) return cur;
    }
    return el;
}

function clickFirstLocationSuggestion(location) {
    const wanted = normalizeText(location);
    const active = document.activeElement;
    const activeRect = active && active.getBoundingClientRect ? active.getBoundingClientRect() : {bottom: 0};

    const textMatches = Array.from(document.querySelectorAll('span, div, li, [role="option"]'))
        .filter(el => isVisible(el))
        .filter(el => {
            const r = el.getBoundingClientRect();
            const txt = normalizeText(el.innerText || el.textContent || '');
            if (!txt || txt.includes('please enter a valid location')) return false;
            if (r.top < activeRect.bottom - 10) return false;
            if (r.left > 450) return false;
            return txt === wanted || txt.startsWith(wanted) || txt.includes(wanted);
        });

    if (textMatches.length) {
        textMatches.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const row = getClickableSuggestionRow(textMatches[0]);
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            clickLikeHuman(row);
            setTimeout(() => {
                document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                document.body.click();
                console.log(`✅ First matching location suggestion clicked: ${location}`);
            }, 700);
        }, 500);
        return true;
    }

    const xList = [60, 90, 140, 200];
    const yList = [activeRect.bottom + 32, activeRect.bottom + 48, activeRect.bottom + 65, activeRect.bottom + 85];
    for (const y of yList) {
        for (const x of xList) {
            const el = document.elementFromPoint(x, y);
            if (!el || !isVisible(el)) continue;
            const row = getClickableSuggestionRow(el);
            const txt = normalizeText(row.innerText || row.textContent || '');
            if (txt && !txt.includes('please enter a valid location') && row.getBoundingClientRect().left < 450) {
                setTimeout(() => {
                    clickLikeHuman(row);
                    setTimeout(() => document.body.click(), 700);
                    console.log(`✅ First location suggestion coordinate-clicked: ${txt}`);
                }, 500);
                return true;
            }
        }
    }

    return false;
}

function typeAndSelectLocation(inputField, location) {
    inputField.focus();
    inputField.click();
    setNativeValue(inputField, '');
    setTimeout(() => {
        setNativeValue(inputField, location);
        inputField.dispatchEvent(new KeyboardEvent('keydown', { key: location.slice(-1) || 'a', bubbles: true }));
        inputField.dispatchEvent(new KeyboardEvent('keyup', { key: location.slice(-1) || 'a', bubbles: true }));

        setTimeout(() => {
            if (clickFirstLocationSuggestion(location)) return;

            inputField.focus();
            inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
            inputField.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
            setTimeout(() => {
                inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                inputField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                setTimeout(() => document.body.click(), 500);
                console.log(`✅ Location keyboard select attempted: ${location}`);
            }, 900);
        }, 2200);
    }, 500);
}

function setMarketplaceLocation(location, listingIndex) {
    if (!location) return;
    const key = `fbAutofillLocationSet_${listingIndex}_${location.replace(/\W/g,'_')}`;
    if (document.body.dataset[key]) return;

    let attempts = 0;
    const maxAttempts = 16;

    function trySet() {
        attempts++;

        const inputField = findLocationInput();
        if (inputField) {
            document.body.dataset[key] = 'true';
            inputField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => typeAndSelectLocation(inputField, location), 700);
            return;
        }

        const card = findLocationCard();
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                card.click();
                setTimeout(() => {
                    const modalInput = findLocationInput();
                    if (modalInput) {
                        document.body.dataset[key] = 'true';
                        typeAndSelectLocation(modalInput, location);
                    } else if (attempts < maxAttempts) {
                        setTimeout(trySet, 1200);
                    } else {
                        console.log('⚠️ Location popup/input not found after click.');
                    }
                }, 1300);
            }, 900);
            return;
        }

        scrollFormDown();
        if (attempts < maxAttempts) setTimeout(trySet, 1200);
        else console.log('⚠️ Location card/input not found.');
    }

    setTimeout(trySet, 2500);
}

function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
        valueSetter.call(element, value);
    } else {
        element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

// FIXED: Improved category detection with better selectors and retry logic
function findCategoryButton() {
    // Try multiple selector strategies to find the category button
    const strategies = [
        () => {
            // Strategy 1: XPath looking for "Category" text with flexible class matching
            const result = document.evaluate(
                "//span[contains(text(), 'Category')] | //label[contains(text(), 'Category')] | //*[@role='button' and contains(., 'Category')]",
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            return result.singleNodeValue;
        },
        () => {
            // Strategy 2: Look for button containing 'Category' with parent context
            const spans = Array.from(document.querySelectorAll('span, label, div[role="button"]'));
            return spans.find(el => el.textContent.includes('Category') && isVisible(el));
        },
        () => {
            // Strategy 3: Find clickable parent around category label
            const labels = Array.from(document.querySelectorAll('*')).filter(el => 
                el.textContent.trim() === 'Category' && isVisible(el)
            );
            for (const label of labels) {
                let parent = label.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.onclick || parent.getAttribute('role') === 'button') {
                        return parent;
                    }
                    parent = parent.parentElement;
                }
            }
            return null;
        }
    ];

    for (const strategy of strategies) {
        try {
            const result = strategy();
            if (result && isVisible(result)) return result;
        } catch (e) {
            console.warn('Category detection strategy failed:', e);
        }
    }
    return null;
}

// FIXED: Improved condition detection with better selectors
function findConditionButton() {
    // Try multiple selector strategies to find the condition button
    const strategies = [
        () => {
            const result = document.evaluate(
                "//span[contains(text(), 'Condition')] | //label[contains(text(), 'Condition')] | //*[@role='button' and contains(., 'Condition')]",
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            return result.singleNodeValue;
        },
        () => {
            const spans = Array.from(document.querySelectorAll('span, label, div[role="button"]'));
            return spans.find(el => el.textContent.includes('Condition') && isVisible(el));
        },
        () => {
            const labels = Array.from(document.querySelectorAll('*')).filter(el => 
                el.textContent.trim() === 'Condition' && isVisible(el)
            );
            for (const label of labels) {
                let parent = label.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.onclick || parent.getAttribute('role') === 'button') {
                        return parent;
                    }
                    parent = parent.parentElement;
                }
            }
            return null;
        }
    ];

    for (const strategy of strategies) {
        try {
            const result = strategy();
            if (result && isVisible(result)) return result;
        } catch (e) {
            console.warn('Condition detection strategy failed:', e);
        }
    }
    return null;
}

// FIXED: Better household/category option finding
function findCategoryOption(categoryName = 'Household') {
    const options = Array.from(document.querySelectorAll('span, div, li, [role="option"]'));
    return options.find(el => {
        const text = (el.textContent || '').trim();
        return text === categoryName && isVisible(el);
    });
}

// FIXED: Better condition option finding
function findConditionOption(conditionName = 'New') {
    const options = Array.from(document.querySelectorAll('span, div, li, [role="option"]'));
    return options.find(el => {
        const text = (el.textContent || '').trim();
        return text === conditionName && isVisible(el);
    });
}

function autofillData() {
    chrome.storage.local.get(["title", "price", "description", "imageDataList", "listings", "locations"], (stored) => {
        const data = pickListingData(stored);
        const selectedLocation = pickLocation(stored, data.__index);
        let attempts = 0;
        let maxAttempts = 10;
        let interval = 2000;
        let maxRetry = 5; // FIXED: Increased max retries for better reliability
        let saveDraftAttempts = 8; // FIXED: Increased save draft attempts

        function tryFillFields() {
            attempts++;
            let allFilled = true;
            let categoryFilled = false;
            let conditionFilled = false;

            let titleField = document.evaluate("//input[contains(@type, 'text')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (titleField && data.title) {
                setNativeValue(titleField, data.title);
            } else {
                allFilled = false;
            }

            let priceField = document.evaluate("(//input[@type='text'])[2]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (priceField && data.price) {
                setNativeValue(priceField, data.price);
            } else {
                allFilled = false;
            }

            let descriptionField = document.evaluate("(//textarea[@class])[1]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (descriptionField && data.description) {
                setNativeValue(descriptionField, data.description);
            } else {
                allFilled = false;
                console.log("⏳ Waiting for description field...");
            }

            if (selectedLocation) {
                setMarketplaceLocation(selectedLocation, data.__index);
            }

            let uploadButton = document.querySelector("input[type='file']");
            const uploadKey = `fbAutofillImagesUploaded_${data.__index}`;
            if (uploadButton && data.imageDataList && data.imageDataList.length > 0 && !uploadButton.dataset[uploadKey]) {
                uploadButton.dataset[uploadKey] = "true";
                let dt = new DataTransfer();
                let imagesToUpload = data.imageDataList.slice(0, 10);

                Promise.all(imagesToUpload.map((imageData, index) => {
                    return fetch(imageData)
                        .then(res => res.blob())
                        .then(blob => {
                            let ext = blob.type === "image/png" ? "png" : "jpg";
                            let file = new File([blob], `listing_${data.__index + 1}_image_${index + 1}.${ext}`, { type: blob.type || "image/jpeg" });
                            dt.items.add(file);
                        });
                })).then(() => {
                    uploadButton.files = dt.files;
                    uploadButton.dispatchEvent(new Event("change", { bubbles: true }));
                    console.log(`✅ Listing ${data.__index + 1}: ${dt.files.length} images uploaded!`);
                }).catch(err => {
                    console.error("❌ Multiple image upload failed:", err);
                    uploadButton.dataset[uploadKey] = "";
                });
            }

            if (priceField && priceField.value.trim() !== "") {
                let categoryAttempts = 0;
                function tryCategory() {
                    categoryAttempts++;
                    let categoryBtn = findCategoryButton();
                    if (categoryBtn && isVisible(categoryBtn)) {
                        clickLikeHuman(categoryBtn);
                        setTimeout(() => {
                            let categoryOpt = findCategoryOption('Household');
                            if (categoryOpt && isVisible(categoryOpt)) { 
                                clickLikeHuman(categoryOpt); 
                                categoryFilled = true;
                                console.log('✅ Category selected: Household');
                            } else if (categoryAttempts < maxRetry) {
                                setTimeout(tryCategory, interval);
                            }
                        }, 1500);
                    } else if (categoryAttempts < maxRetry) {
                        setTimeout(tryCategory, interval);
                    }
                }
                tryCategory();
            }

            if (priceField && priceField.value.trim() !== "") {
                let conditionAttempts = 0;
                function tryCondition() {
                    conditionAttempts++;
                    let conditionBtn = findConditionButton();
                    if (conditionBtn && isVisible(conditionBtn)) {
                        clickLikeHuman(conditionBtn);
                        setTimeout(() => {
                            let conditionOpt = findConditionOption('New');
                            if (conditionOpt && isVisible(conditionOpt)) { 
                                clickLikeHuman(conditionOpt); 
                                conditionFilled = true;
                                console.log('✅ Condition selected: New');
                            } else if (conditionAttempts < maxRetry) {
                                setTimeout(tryCondition, interval);
                            }
                        }, 2000);
                    } else if (conditionAttempts < maxRetry) {
                        setTimeout(tryCondition, interval);
                    }
                }
                tryCondition();
            }

            if (descriptionField && descriptionField.value.trim() !== "") {
                let saveDraftAttemptsLeft = saveDraftAttempts;
                function trySaveDraft() {
                    if (allFilled && categoryFilled && conditionFilled) {
                        saveDraftAttemptsLeft--;
                        let saveDraftButton = document.evaluate("//span[contains(text(), 'Save draft')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if (saveDraftButton && isVisible(saveDraftButton)) {
                            clickLikeHuman(saveDraftButton);
                            console.log("✅ Save Draft button clicked!");
                        } else if (saveDraftAttemptsLeft > 0) {
                            setTimeout(trySaveDraft, interval);
                        }
                    } else if (saveDraftAttemptsLeft > 0) {
                        setTimeout(trySaveDraft, interval);
                    }
                }
                trySaveDraft();
            } else if (attempts < maxAttempts) {
                setTimeout(tryFillFields, interval);
            }
        }

        tryFillFields();
    });
}

autofillData();
chrome.storage.onChanged.addListener(() => {
    autofillData();
});
