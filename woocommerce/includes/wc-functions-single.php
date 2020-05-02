<?php
if ( ! defined('ABSPATH')){
    exit; 
}

remove_action( 'woocommerce_before_main_content', 'woocommerce_breadcrumb', 20);
add_action( 'woocommerce_before_main_content', 'md_add_breadcrumbs', 20);
function md_add_breadcrumbs(){
    ?>
    <section class="md_bc">
        <div class="wrapper">
            <?php woocommerce_breadcrumb(); ?>  
        </div>
    </section>
<?php
}

add_action ('woocommerce_before_single_product', 'md_wrapper_product_start', 5);
function md_wrapper_product_start(){
    ?>
        <div class="product">
            <div class="wrapper">
    <?php
}
add_action ('woocommerce_after_single_product', 'md_wrapper_product_end', 5);
function md_wrapper_product_end(){
    ?>
            </div>
        </div>
    <?php
}

add_action ('woocommerce_before_single_product_summary', 'md_wrapper_product_image_start', 5);
function md_wrapper_product_image_start(){
    ?>
        <section class="md_image">
            <div class="wrapper">
    <?php
}
add_action ('woocommerce_before_single_product_summary', 'md_wrapper_product_image_end', 25);
function md_wrapper_product_image_end(){
    ?> 
            </div>
        </section>
    <?php
}
add_action ('woocommerce_before_single_product_summary', 'md_wrapper_product_entry_start', 30);
function md_wrapper_product_entry_start(){
    ?>
        <section class="md_entry">
            <div class="wrapper">
    <?php
}
add_action ('woocommerce_after_single_product_summary', 'md_wrapper_product_entry_end', 5);
function md_wrapper_product_entry_end(){
    ?> 
                </div>
        </section>
        
    <?php
}
