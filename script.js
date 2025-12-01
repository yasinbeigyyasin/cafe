document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- اینیشیالایز کردن Swiper ---
    // --- اینیشیالایز کردن Swiper (اصلاح شده) ---
    const swiper = new Swiper('.swiper', {
        // فعال کردن حالت راست‌چین برای اصلاح فیزیک حرکت
        rtl: true, 
        
        effect: 'coverflow',
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        loop: false,
        coverflowEffect: {
            rotate: 20,
            stretch: 0,
            depth: 250,
            modifier: 1,
            slideShadows: true,
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        // اصلاح جهت دکمه‌ها:
        // دکمه سمت چپ (prev) باید اسلاید بعدی (next) را بیاورد (حرکت به چپ)
        // دکمه سمت راست (next) باید اسلاید قبلی (prev) را بیاورد (حرکت به راست)
        navigation: {
            nextEl: '.swiper-button-prev', 
            prevEl: '.swiper-button-next',
        },
    });

    console.log("Swiper initialized.");

    // --- انتخاب المان‌های اصلی از DOM ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    const swiperContainer = document.querySelector('.swiper-container');
    const verticalMenuContainer = document.querySelector('.vertical-menu-container');
    const productsSource = document.getElementById('all-products-source');

    if (!productsSource) {
        console.error("CRITICAL ERROR: The element with id 'all-products-source' was not found!");
        return;
    }

    const allProductItems = Array.from(productsSource.querySelectorAll('.product-item'));
    console.log(`Found ${allProductItems.length} products in the source.`);

    // --- متغیرهای اسکرول خودکار ---
    let autoScrollInterval;
    let isUserInteracting = false;
    let interactionTimeout;

    // --- اسکرول خودکار ---
    function initAutoScroll() {
        console.log("Initializing auto-scroll...");
        
        // پاک کردن interval قبلی اگر وجود دارد
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
        }
        
        setupSwiperAutoScroll();
        setupVerticalMenuAutoScroll();
    }

    function setupSwiperAutoScroll() {
        console.log("Setting up swiper auto-scroll");
        
        autoScrollInterval = setInterval(() => {
            const activeFilter = document.querySelector('.filter-btn.active');
            const isBestseller = activeFilter && activeFilter.dataset.filter === 'bestseller';
            const isSwiperVisible = swiperContainer.style.display !== 'none';
            
            if (!isUserInteracting && isBestseller && isSwiperVisible && swiper) {
                console.log("Auto-sliding to next slide");
                swiper.slideNext();
            }
        }, 4000);
    }

    function setupVerticalMenuAutoScroll() {
        console.log("Setting up vertical menu auto-scroll");
        
        const verticalMenu = document.querySelector('.vertical-menu-container');
        if (!verticalMenu) return;
        
        let scrollDirection = 1;
        let scrollStep = 1;
        
        function autoScrollVertical() {
            const activeFilter = document.querySelector('.filter-btn.active');
            const isVerticalVisible = verticalMenu.style.display !== 'none';
            const isNotBestseller = activeFilter && activeFilter.dataset.filter !== 'bestseller';
            
            if (!isUserInteracting && isVerticalVisible && isNotBestseller) {
                const currentScroll = verticalMenu.scrollTop;
                const maxScroll = verticalMenu.scrollHeight - verticalMenu.clientHeight;
                
                if (currentScroll >= maxScroll - 10) {
                    scrollDirection = -1;
                } else if (currentScroll <= 10) {
                    scrollDirection = 1;
                }
                
                verticalMenu.scrollTop += scrollDirection * scrollStep;
            }
        }
        
        setInterval(autoScrollVertical, 30);
    }

    // تشخیص تعامل کاربر
    function setUserInteracting() {
        isUserInteracting = true;
        clearTimeout(interactionTimeout);
        
        interactionTimeout = setTimeout(() => {
            isUserInteracting = false;
            console.log("User interaction ended, auto-scroll resumed");
        }, 3000);
    }

    // اضافه کردن event listeners برای تعامل کاربر
    document.addEventListener('click', setUserInteracting);
    document.addEventListener('touchstart', setUserInteracting);
    document.addEventListener('wheel', setUserInteracting);
    document.addEventListener('mousemove', setUserInteracting);

    // --- تابع اصلی برای فیلتر کردن و نمایش محصولات ---
    function renderProducts(filter) {
        console.log(`Rendering for filter: '${filter}'`);

        const filteredItems = allProductItems.filter(item => {
            const categories = item.dataset.categories || '';
            return categories.split(' ').includes(filter);
        });

        console.log(`Found ${filteredItems.length} items for this filter.`);

        if (filter === 'bestseller') {
            verticalMenuContainer.style.display = 'none';
            swiperContainer.style.display = 'block';

            swiper.removeAllSlides();
            
            if (filteredItems.length > 0) {
                filteredItems.forEach(item => {
                    const newSlide = document.createElement('div');
                    newSlide.className = 'swiper-slide';
                    newSlide.innerHTML = item.innerHTML;
                    swiper.appendSlide(newSlide);
                });
            }
            
            if (filteredItems.length > 3) {
                swiper.params.loop = true;
                swiper.loopCreate();
            } else {
                swiper.params.loop = false;
                swiper.loopDestroy();
            }
            
            swiper.update();
            swiper.slideTo(0, 0);

        } else {
            swiperContainer.style.display = 'none';
            verticalMenuContainer.innerHTML = '';
            
            if (filteredItems.length > 0) {
                filteredItems.forEach(item => {
                    const productCard = item.querySelector('.product-card').cloneNode(true);
                    verticalMenuContainer.appendChild(productCard);
                });
                verticalMenuContainer.style.display = 'grid';
            } else {
                verticalMenuContainer.style.display = 'none';
            }
        }

        // بعد از رندر کردن محصولات، اسکرول خودکار را مجدداً تنظیم کن
        setTimeout(initAutoScroll, 500);
    }

    // --- اضافه کردن رویداد کلیک به دکمه‌های فیلتر ---
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filterValue = button.dataset.filter;
            renderProducts(filterValue);
        });
    });

    // --- اجرای اولیه در هنگام بارگذاری صفحه ---
    if (allProductItems.length > 0) {
        renderProducts('bestseller');
    } else {
        console.warn("No products found to render initially.");
    }

    // --- شروع اسکرول خودکار بعد از لود کامل ---
    setTimeout(() => {
        initAutoScroll();
    }, 2000);

    // --- مدیریت صفحه اسپلش ---
    const splashScreen = document.getElementById('splash-screen');
    const mainContainer = document.getElementById('main-container');

    if (mainContainer) {
        mainContainer.classList.add('loading');
    }

    if (splashScreen) {
        const totalAnimationTime = 6000;

        setTimeout(() => {
            splashScreen.style.opacity = '0';
            splashScreen.style.pointerEvents = 'none';

            if (mainContainer) {
                mainContainer.classList.remove('loading');
                mainContainer.classList.add('loaded');
            }

            splashScreen.addEventListener('transitionend', () => {
                if (splashScreen.parentNode) {
                    splashScreen.parentNode.removeChild(splashScreen);
                }
            });

        }, totalAnimationTime);
    } else {
        console.warn("Splash screen not found. Displaying site directly.");
        if (mainContainer) {
            mainContainer.classList.remove('loading');
            mainContainer.classList.add('loaded');
        }
    }

        // --- انیمیشن تایپ برای شعار (اصلاح شده و بدون باگ) ---
    const sloganElement = document.querySelector(".splash-slogan");
    
    if (sloganElement) {
        const text = "سلامتی، طعم واقعی زندگیست 🌿";
        // استفاده از Array.from برای شناسایی صحیح ایموجی به عنوان یک کاراکتر
        const characters = Array.from(text); 
        let index = 0;
        
        // ابتدا متن را خالی می‌کنیم تا تداخلی نباشد
        sloganElement.textContent = ""; 

        function typeLetter() {
            if (index < characters.length) {
                // اضافه کردن کاراکتر فعلی به متن
                sloganElement.textContent += characters[index];
                index++;
                
                // سرعت تایپ تصادفی برای طبیعی‌تر شدن
                const speed = 80 + Math.random() * 60; 
                setTimeout(typeLetter, speed);
            } else {
                // --- پایان تایپ و شروع محو شدن ---
                setTimeout(() => {
                    const splash = document.getElementById("splash-screen");
                    if (splash) {
                        splash.style.opacity = "0";
                        // غیرفعال کردن کلیک روی اسپلش هنگام محو شدن
                        splash.style.pointerEvents = "none"; 
                        
                        setTimeout(() => {
                            splash.style.display = "none";
                            
                            // اطلاع به کانتینر اصلی که لود تمام شده
                            const mainContainer = document.getElementById("main-container");
                            if (mainContainer) {
                                mainContainer.classList.remove('loading');
                                mainContainer.classList.add('loaded');
                            }
                        }, 800);
                    }
                }, 1500); // مکث بعد از پایان تایپ
            }
        }

        // شروع تایپ با کمی تاخیر
        setTimeout(typeLetter, 1000);
    }

});
function setupVerticalMenuAutoScroll() {
    console.log("Setting up vertical menu auto-scroll");
    
    const verticalMenu = document.querySelector('.vertical-menu-container');
    if (!verticalMenu) return;
    
    let currentCardIndex = 0;
    
    verticalScrollInterval = setInterval(() => {
        const activeFilter = document.querySelector('.filter-btn.active');
        const isVerticalVisible = verticalMenu.style.display !== 'none' && 
                               verticalMenu.style.display !== '';
        const isNotBestseller = activeFilter && activeFilter.dataset.filter !== 'bestseller';
        const productCards = verticalMenu.querySelectorAll('.product-card');
        
        if (!isUserInteracting && isVerticalVisible && isNotBestseller && productCards.length > 1) {
            
            // محاسبه کارت بعدی
            currentCardIndex = (currentCardIndex + 1) % productCards.length;
            const nextCard = productCards[currentCardIndex];
            
            if (nextCard) {
                const cardTop = nextCard.offsetTop;
                
                // اسکرول فوری بدون انیمیشن
                verticalMenu.scrollTop = cardTop - 10;
                
                console.log(`Fast scrolling to card ${currentCardIndex + 1}`);
            }
        }
    }, 1200); // هر 1.5 ثانیه
}
// پاک کردن interval وقتی صفحه بسته می‌شود
window.addEventListener('beforeunload', () => {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
    }
    if (interactionTimeout) {
        clearTimeout(interactionTimeout);
    }
});
