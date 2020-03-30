<?php
/*
Template Name: Сертификаты
*/
get_header();
?>
<?php if (get_field('certificatesSection')) : ?>
            <?php while (have_rows('certificatesSection')) : the_row();
                $cS_title = get_sub_field('cS_title');
                $cS_content = get_sub_field('cS_content');
                $cS_gallery = get_sub_field('cS_gallery');?>
                <section class="company">
                    <div class="wrapper">
                        <h2 class="title alt2"><?php echo $cS_title; ?></h2>
                        <p class="text"><?php echo $cS_content; ?></p>
                        <?php echo $cS_gallery; ?>
                    </div>
                </section>
            <?php endwhile; ?>
         <?php endif; ?>
<?php get_footer(); ?>