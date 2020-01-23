<?php


add_action( 'wp_enqueue_scripts', 'style_theme' );
add_action('wp_footer', 'scripts_theme');
add_theme_support('woocommerce');


function style_theme() {
	wp_enqueue_style('reset', get_template_directory_uri() . '/assets/css/reset.css');
	wp_enqueue_style( 'bundle', get_template_directory_uri() . '/assets/css/bundle.css' );
}

function scripts_theme() {
	wp_enqueue_script('bundle', get_template_directory_uri() . '/assets/js/bundle.js');
}



add_theme_support ('custom-logo');
add_theme_support('menus');


add_filter('woocommerce_add_to_cart_fragments', 'header_add_to_cart_fragment');
add_filter( 'woocommerce_cart_needs_payment', '__return_false' );

remove_action( 'woocommerce_after_single_product_summary', 'woocommerce_output_related_products', 20 );
remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_meta', 40 );

function header_add_to_cart_fragment( $fragments ) {
    global $woocommerce;
    ob_start();
    ?>
    <span class="basket-btn__counter">(<?php echo sprintf($woocommerce->cart->cart_contents_count); ?>)</span>
    <?php
    $fragments['.basket-btn__counter'] = ob_get_clean();
    return $fragments;
}


add_filter('woocommerce_subcategory_count_html','remove_count');

function remove_count(){
    $html='';
    return $html;
}
?>
